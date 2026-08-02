"""
Regras de negócio do catálogo.

Mantidas fora das views, como em `encomendas/services.py`, para poderem ser
testadas sem HTTP e reutilizadas pelo painel de administração.
"""

import logging

from django.db import transaction
from django.db.models import Q

# Reutiliza a excepção já usada em toda a loja em vez de criar um segundo
# vocabulário de erros para a mesma coisa.
from encomendas.services import ErroDeNegocio

from .models import Avaliacao, FotoAvaliacao

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
