"""
Regras de negócio das encomendas.

Mantidas fora das views para poderem ser testadas sem HTTP e reutilizadas pelo
painel de administração.
"""

import logging
import secrets

from django.conf import settings
from django.db import transaction
from django.db.models import F, Max
from django.db.models.functions import Cast
from django.db import models
from django.utils import timezone

from catalogo.models import Variante

from .middleware import CHAVE_SESSAO_CARRINHO
from .models import (
    Carrinho,
    Encomenda,
    EstadoEncomenda,
    EstadoPagamento,
    EventoEncomenda,
    ItemCarrinho,
    ItemEncomenda,
    calcular_envio,
    deve_repor_stock,
    pode_transitar,
)

logger = logging.getLogger(__name__)


class ErroDeNegocio(Exception):
    """Erro esperado, com mensagem destinada ao utilizador."""


class StockInsuficiente(ErroDeNegocio):
    pass


# ─── Carrinho ─────────────────────────────────────────────────────────────────


def obter_carrinho(request, criar=True):
    """
    Devolve o carrinho do pedido: o do utilizador autenticado ou, em navegação
    anónima, o associado à sessão.
    """
    if request.user.is_authenticated:
        if criar:
            carrinho, _ = Carrinho.objects.get_or_create(utilizador=request.user)
            return carrinho
        return Carrinho.objects.filter(utilizador=request.user).first()

    chave = request.session.get(CHAVE_SESSAO_CARRINHO)
    if not chave:
        return None
    if criar:
        carrinho, _ = Carrinho.objects.get_or_create(chave_sessao=chave)
        return carrinho
    return Carrinho.objects.filter(chave_sessao=chave).first()


def adicionar_ao_carrinho(request, variante, quantidade=1):
    """Acrescenta uma variante, travando sempre no stock disponível."""
    carrinho = obter_carrinho(request)

    if not variante.activa or not variante.produto.activo:
        raise ErroDeNegocio("Esta variante já não está disponível.")
    if variante.stock == 0:
        raise StockInsuficiente(f"{variante.produto.nome} está esgotado.")

    item = carrinho.itens.filter(variante=variante).first()
    desejado = (item.quantidade if item else 0) + quantidade

    if desejado > variante.stock:
        raise StockInsuficiente(
            f"Só temos {variante.stock} unidade(s) de {variante.produto.nome} "
            f"em {variante.tamanho} / {variante.cor_nome}."
        )

    if item:
        item.quantidade = desejado
        item.save(update_fields=["quantidade", "actualizado_em"])
    else:
        ItemCarrinho.objects.create(carrinho=carrinho, variante=variante, quantidade=quantidade)

    return carrinho


def actualizar_quantidade(request, item_id, quantidade):
    carrinho = obter_carrinho(request)
    item = carrinho.itens.filter(pk=item_id).select_related("variante").first()
    if not item:
        raise ErroDeNegocio("Item não encontrado no carrinho.")

    if quantidade <= 0:
        item.delete()
        return carrinho

    if quantidade > item.variante.stock:
        raise StockInsuficiente(f"Só temos {item.variante.stock} unidade(s) desta variante.")

    item.quantidade = quantidade
    item.save(update_fields=["quantidade", "actualizado_em"])
    return carrinho


def remover_do_carrinho(request, item_id):
    carrinho = obter_carrinho(request)
    carrinho.itens.filter(pk=item_id).delete()
    return carrinho


def fundir_carrinho_anonimo(request, utilizador):
    """
    Funde o carrinho anónimo no do utilizador ao iniciar sessão.

    Soma quantidades em vez de substituir — quem juntou peças antes de entrar na
    conta não as deve perder — mas trava sempre no stock, senão a fusão criaria
    linhas impossíveis de comprar.
    """
    chave = request.session.get(CHAVE_SESSAO_CARRINHO)
    if not chave:
        return

    anonimo = Carrinho.objects.filter(chave_sessao=chave).prefetch_related("itens__variante").first()
    if not anonimo:
        return

    if not anonimo.itens.exists():
        anonimo.delete()
        return

    do_utilizador, _ = Carrinho.objects.get_or_create(utilizador=utilizador)

    with transaction.atomic():
        for item in anonimo.itens.all():
            existente = do_utilizador.itens.filter(variante=item.variante).first()
            somado = (existente.quantidade if existente else 0) + item.quantidade
            limitado = min(somado, item.variante.stock)
            if limitado <= 0:
                continue

            if existente:
                existente.quantidade = limitado
                existente.save(update_fields=["quantidade", "actualizado_em"])
            else:
                ItemCarrinho.objects.create(
                    carrinho=do_utilizador, variante=item.variante, quantidade=limitado
                )
        anonimo.delete()


# ─── Encomendas ───────────────────────────────────────────────────────────────


def proxima_referencia():
    """
    Gera "CP-2045", continuando a numeração existente.

    Arranca em 2040 para a sequência parecer contínua com o histórico mostrado
    no desenho original.
    """
    maior = (
        Encomenda.objects.annotate(
            numero=Cast(models.functions.Substr("referencia", 4), models.BigIntegerField())
        ).aggregate(m=Max("numero"))["m"]
        or 2040
    )
    return f"CP-{maior + 1}"


@transaction.atomic
def criar_encomenda(request, dados, cupao=None):
    """
    Cria a encomenda a partir do carrinho.

    Tudo numa transacção: validar stock, decrementá-lo, criar encomenda, linhas
    e pagamento pendente, e esvaziar o carrinho. Se algum passo falhar, nada
    fica meio feito.
    """
    carrinho = obter_carrinho(request)
    itens = list(carrinho.linhas) if carrinho else []
    if not itens:
        raise ErroDeNegocio("O carrinho está vazio.")

    subtotal = sum(item.total_linha for item in itens)
    desconto = cupao.desconto_para(subtotal) if cupao else 0
    envio = calcular_envio(subtotal - desconto)
    total = subtotal - desconto + envio

    # ── 1. Decremento condicional do stock ────────────────────────────────────
    #
    # `filter(stock__gte=...).update(...)` é concorrência optimista numa só
    # instrução SQL: se dois clientes carregarem em "Pagar" no mesmo instante
    # pela última peça, um ganha e o outro recebe erro. Ler o stock e só depois
    # escrevê-lo teria uma janela de corrida entre os dois passos — e venderia
    # a mesma peça duas vezes.
    for item in itens:
        actualizadas = Variante.objects.filter(
            pk=item.variante_id, stock__gte=item.quantidade
        ).update(stock=F("stock") - item.quantidade)

        if actualizadas == 0:
            actual = Variante.objects.filter(pk=item.variante_id).values_list("stock", flat=True)
            disponivel = actual[0] if actual else 0
            raise StockInsuficiente(
                f"{item.variante.produto.nome} "
                f"({item.variante.tamanho} / {item.variante.cor_nome}) "
                f"já só tem {disponivel} unidade(s) disponíveis."
            )

    # ── 2. Encomenda ──────────────────────────────────────────────────────────
    encomenda = Encomenda.objects.create(
        referencia=proxima_referencia(),
        utilizador=request.user if request.user.is_authenticated else None,
        nome_cliente=dados["nome_cliente"],
        email=dados["email"].lower(),
        telefone=dados["telefone"],
        subtotal=subtotal,
        envio=envio,
        desconto=desconto,
        total=total,
        provincia=dados["provincia"],
        municipio=dados["municipio"],
        rua=dados["rua"],
        observacoes=dados.get("observacoes", ""),
        cupao=cupao,
    )

    ItemEncomenda.objects.bulk_create(
        [
            ItemEncomenda(
                encomenda=encomenda,
                variante=item.variante,
                marca=item.variante.produto.marca.nome,
                nome_produto=item.variante.produto.nome,
                slug_produto=item.variante.produto.slug,
                url_imagem=item.variante.produto.imagem_principal or "",
                tamanho=item.variante.tamanho,
                cor_nome=item.variante.cor_nome,
                sku=item.variante.sku,
                preco_unitario=item.preco_unitario,
                quantidade=item.quantidade,
                total_linha=item.total_linha,
            )
            for item in itens
        ]
    )

    EventoEncomenda.objects.create(
        encomenda=encomenda,
        estado_novo=EstadoEncomenda.NOVA,
        nota="Encomenda criada.",
    )

    # ── 3. Cupão e limpeza ────────────────────────────────────────────────────
    if cupao:
        cupao.vezes_usado = F("vezes_usado") + 1
        cupao.save(update_fields=["vezes_usado"])

    carrinho.itens.all().delete()

    logger.info("Encomenda criada: %s (%s Kz)", encomenda.referencia, encomenda.total)
    return encomenda


@transaction.atomic
def mudar_estado(encomenda, novo_estado, autor=None, nota=""):
    """
    Muda o estado respeitando a máquina de estados e repondo o stock quando é
    cancelada. A flag `stock_reposto` impede reposição a dobrar.
    """
    encomenda = Encomenda.objects.select_for_update().get(pk=encomenda.pk)
    anterior = encomenda.estado

    if anterior == novo_estado:
        return encomenda

    if not pode_transitar(anterior, novo_estado):
        raise ErroDeNegocio(
            f'Não é possível passar de "{EstadoEncomenda(anterior).label}" '
            f'para "{EstadoEncomenda(novo_estado).label}".'
        )

    if deve_repor_stock(anterior, novo_estado) and not encomenda.stock_reposto:
        for item in encomenda.itens.select_related("variante"):
            if item.variante_id:
                Variante.objects.filter(pk=item.variante_id).update(
                    stock=F("stock") + item.quantidade
                )
        encomenda.stock_reposto = True

    encomenda.estado = novo_estado
    encomenda.save(update_fields=["estado", "stock_reposto", "actualizado_em"])

    EventoEncomenda.objects.create(
        encomenda=encomenda,
        estado_anterior=anterior,
        estado_novo=novo_estado,
        nota=nota,
        autor=autor,
    )

    logger.info("Encomenda %s: %s → %s", encomenda.referencia, anterior, novo_estado)
    return encomenda


# ─── Pagamentos ───────────────────────────────────────────────────────────────


def nova_referencia_pagamento():
    return f"CPP-{secrets.token_hex(10).upper()}"


def aplicar_resultado_pagamento(pagamento, estado, referencia_provedor=None, motivo="", bruto=None):
    """
    Aplica um resultado e propaga-o para a encomenda.

    Idempotente: a EMIS reenvia callbacks em caso de timeout, e confirmar a
    mesma encomenda duas vezes seria um erro contabilístico.
    """
    if pagamento.estado == estado:
        return pagamento

    if pagamento.estado != EstadoPagamento.PENDENTE:
        logger.warning(
            "Callback ignorado: pagamento %s já está %s", pagamento.referencia, pagamento.estado
        )
        return pagamento

    pagamento.estado = estado
    if referencia_provedor:
        pagamento.referencia_provedor = referencia_provedor
    pagamento.motivo_falha = motivo or ""
    pagamento.pago_em = timezone.now() if estado == EstadoPagamento.PAGO else None
    if bruto is not None:
        pagamento.resposta_bruta = bruto
    pagamento.save()

    encomenda = pagamento.encomenda
    if estado == EstadoPagamento.PAGO and encomenda.estado == EstadoEncomenda.NOVA:
        mudar_estado(encomenda, EstadoEncomenda.CONFIRMADA, nota=f"Pagamento confirmado ({pagamento.provedor}).")
    elif estado == EstadoPagamento.CANCELADO and encomenda.estado == EstadoEncomenda.NOVA:
        mudar_estado(encomenda, EstadoEncomenda.CANCELADA, nota="Pagamento cancelado pelo cliente.")

    return pagamento


# ─── Prazos de entrega ────────────────────────────────────────────────────────
#
# A loja está em Luanda, por isso é aí que entrega mais depressa. Os prazos são
# em dias úteis e por província — dar o mesmo prazo a Luanda e ao Lubango seria
# prometer o que não se cumpre.
PRAZOS_ENTREGA = {
    "Luanda": (1, 3),
    "Benguela": (3, 5),
    "Cabinda": (4, 7),
    "Huambo": (4, 6),
    "Huíla": (4, 7),
    "Malanje": (4, 6),
    "Namibe": (5, 8),
    "Uíge": (4, 7),
}
PRAZO_PADRAO = (4, 8)


def _somar_dias_uteis(inicio, dias):
    """Avança `dias` dias úteis, saltando sábados e domingos."""
    data = inicio
    restantes = dias
    while restantes > 0:
        data += timezone.timedelta(days=1)
        if data.weekday() < 5:
            restantes -= 1
    return data


def previsao_de_entrega(provincia, desde=None):
    """
    Janela de entrega estimada para uma província.

    Devolve os limites em dias úteis e, quando lhe damos uma data de partida,
    também as datas concretas. É uma estimativa da loja, não um compromisso da
    transportadora — o texto apresentado di-lo com "prevista".
    """
    minimo, maximo = PRAZOS_ENTREGA.get(provincia, PRAZO_PADRAO)
    previsao = {
        "minimo": minimo,
        "maximo": maximo,
        "texto": f"{minimo}–{maximo} dias úteis",
        "de": None,
        "ate": None,
    }
    if desde:
        previsao["de"] = _somar_dias_uteis(desde, minimo)
        previsao["ate"] = _somar_dias_uteis(desde, maximo)
    return previsao


def alertas_de_stock(limite=200):
    """Variantes no limiar ou abaixo — alimenta o painel e o dashboard."""
    variantes = (
        Variante.objects.filter(activa=True, produto__activo=True)
        .select_related("produto", "produto__marca")
        .order_by("stock")[:limite]
    )
    return [v for v in variantes if v.stock <= v.limiar_stock_baixo]
