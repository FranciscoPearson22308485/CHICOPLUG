"""
Regras de negócio do catálogo.

Mantidas fora das views, como em `encomendas/services.py`, para poderem ser
testadas sem HTTP e reutilizadas pelo painel de administração.
"""

import logging

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

# Reutiliza a excepção já usada em toda a loja em vez de criar um segundo
# vocabulário de erros para a mesma coisa.
from encomendas.services import ErroDeNegocio

from .models import AlertaReposicao, Avaliacao, FotoAvaliacao

logger = logging.getLogger(__name__)

# Uma encomenda ainda por pagar não é uma compra. Cancelada também não. Tudo o
# resto significa que o cliente pagou e ficou com a peça — é o que dá direito
# a avaliá-la.
ESTADOS_QUE_CONTAM_COMO_COMPRA = ["CONFIRMADA", "EM_PREPARACAO", "ENVIADA", "ENTREGUE"]

MAXIMO_FOTOGRAFIAS = 4


def comprou(utilizador, produto) -> bool:
    """
    Diz se este cliente chegou mesmo a comprar esta peça.

    Cruza pela variante e também pelo slug guardado na linha: a variante pode
    ter sido removida do catálogo entretanto (`on_delete=SET_NULL`), mas o
    instantâneo da compra sobrevive e continua a ser prova.
    """
    if not utilizador.is_authenticated:
        return False

    from encomendas.models import ItemEncomenda

    return (
        ItemEncomenda.objects.filter(
            Q(variante__produto=produto) | Q(slug_produto=produto.slug),
            encomenda__utilizador=utilizador,
            encomenda__estado__in=ESTADOS_QUE_CONTAM_COMO_COMPRA,
        )
        .exists()
    )


def ja_avaliou(utilizador, produto) -> bool:
    if not utilizador.is_authenticated:
        return False
    return Avaliacao.objects.filter(produto=produto, utilizador=utilizador).exists()


def pode_avaliar(utilizador, produto) -> bool:
    return comprou(utilizador, produto) and not ja_avaliou(utilizador, produto)


def motivo_para_nao_avaliar(utilizador, produto):
    """Mensagem a mostrar quando o formulário não aparece, ou None."""
    if not utilizador.is_authenticated:
        return "Entra na tua conta para avaliares esta peça."
    if ja_avaliou(utilizador, produto):
        return "Já avaliaste esta peça."
    if not comprou(utilizador, produto):
        return "Só quem comprou esta peça a pode avaliar."
    return None


@transaction.atomic
def criar_avaliacao(utilizador, produto, estrelas, comentario="", fotografias=None):
    """
    Regista a avaliação depois de confirmar que o cliente comprou a peça.

    A verificação é feita aqui, e não na view, para que nenhuma via de entrada
    futura (painel, importação, API) a possa contornar por esquecimento.
    """
    try:
        estrelas = int(estrelas)
    except (TypeError, ValueError):
        raise ErroDeNegocio("Escolhe uma classificação de 1 a 5 estrelas.")

    if not 1 <= estrelas <= 5:
        raise ErroDeNegocio("A classificação tem de ser entre 1 e 5 estrelas.")

    if not comprou(utilizador, produto):
        raise ErroDeNegocio("Só quem comprou esta peça a pode avaliar.")

    if ja_avaliou(utilizador, produto):
        raise ErroDeNegocio("Já avaliaste esta peça.")

    avaliacao = Avaliacao.objects.create(
        produto=produto,
        utilizador=utilizador,
        estrelas=estrelas,
        comentario=(comentario or "").strip(),
        compra_verificada=True,
    )

    for ficheiro in (fotografias or [])[:MAXIMO_FOTOGRAFIAS]:
        FotoAvaliacao.objects.create(avaliacao=avaliacao, ficheiro=ficheiro)

    logger.info("Avaliação criada: %s — %s★", produto.slug, estrelas)
    return avaliacao


# Ordenações oferecidas na ficha de produto.
ORDENACOES = {
    "recentes": "Mais recentes",
    "melhores": "Melhor classificação",
    "fotos": "Com fotografias",
}


def avaliacoes_de(produto, ordenar="recentes"):
    """Lista publicada da peça, já ordenada e sem consultas em cascata."""
    lista = produto.avaliacoes.publicadas().completas()

    if ordenar == "melhores":
        return lista.order_by("-estrelas", "-criado_em")
    if ordenar == "fotos":
        return lista.com_fotografias().order_by("-criado_em")
    return lista.order_by("-criado_em")


# ─── Alertas de reposição ─────────────────────────────────────────────────────


def registar_alerta(produto, nome, email, telefone="", variante=None):
    """
    Inscreve alguém na lista de espera de uma peça esgotada.

    Repetir a inscrição não cria uma segunda linha: quem carrega duas vezes no
    botão não deve receber dois avisos.
    """
    email = (email or "").strip().lower()
    if "@" not in email:
        raise ErroDeNegocio("Indica um email válido.")

    nome = (nome or "").strip()
    if not nome:
        raise ErroDeNegocio("Indica o teu nome.")

    existente = AlertaReposicao.objects.filter(
        produto=produto, email=email, notificado_em__isnull=True
    ).first()
    if existente:
        return existente

    alerta = AlertaReposicao.objects.create(
        produto=produto, variante=variante, nome=nome,
        email=email, telefone=(telefone or "").strip(),
    )
    logger.info("Alerta de reposição registado: %s → %s", email, produto.slug)
    return alerta


def notificar_reposicoes(produto):
    """
    Avisa quem estava à espera desta peça e marca os alertas como tratados.

    Chamada quando o stock volta a subir acima de zero. Marca antes de enviar
    é deliberado: se o envio falhar, é preferível não avisar do que avisar a
    mesma pessoa a cada gravação de stock seguinte.
    """
    if not produto.tem_stock:
        return 0

    pendentes = list(
        AlertaReposicao.objects.filter(produto=produto, notificado_em__isnull=True)
    )
    if not pendentes:
        return 0

    from .notificacoes import avisar_reposicao

    agora = timezone.now()
    AlertaReposicao.objects.filter(pk__in=[a.pk for a in pendentes]).update(notificado_em=agora)

    for alerta in pendentes:
        avisar_reposicao(alerta)

    logger.info("Reposição de %s: %s pessoa(s) avisada(s)", produto.slug, len(pendentes))
    return len(pendentes)


# ─── Galeria dos clientes ─────────────────────────────────────────────────────


def _cidades_por_cliente(ids_utilizadores):
    """
    {id_utilizador: município da encomenda mais recente}.

    Uma consulta para todos, em vez de uma por fotografia. A ordenação
    ascendente é deliberada: ao construir o dicionário, a última escrita de
    cada cliente fica a ser a encomenda mais recente.
    """
    if not ids_utilizadores:
        return {}

    from encomendas.models import Encomenda

    return dict(
        Encomenda.objects.filter(utilizador_id__in=ids_utilizadores)
        .exclude(municipio="")
        .order_by("utilizador_id", "criado_em")
        .values_list("utilizador_id", "municipio")
    )


def galeria_de_clientes(limite=60, produto=None):
    """
    Fotografias reais enviadas pelos clientes com as suas avaliações.

    Não há um segundo sistema de upload: a galeria é a vista agregada das
    fotografias das avaliações. Esconder uma avaliação no painel retira-a
    daqui também, sem moderação separada.
    """
    fotos = (
        FotoAvaliacao.objects.filter(avaliacao__publicada=True)
        .select_related("avaliacao", "avaliacao__produto", "avaliacao__produto__marca", "avaliacao__utilizador")
        .order_by("-criado_em")
    )
    if produto is not None:
        fotos = fotos.filter(avaliacao__produto=produto)

    fotos = [f for f in fotos[:limite] if f.url_imagem]

    cidades = _cidades_por_cliente({f.avaliacao.utilizador_id for f in fotos})
    for foto in fotos:
        # Anexado à instância para o template não disparar consultas.
        foto.cidade = cidades.get(foto.avaliacao.utilizador_id, "")

    return fotos
