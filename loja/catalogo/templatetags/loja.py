"""
Filtros de template partilhados por toda a loja.

Registados como `builtins` nas definições, para não ser preciso repetir
`{% load loja %}` em cada um dos ~40 templates.
"""

import json

from django import template
from django.utils.safestring import mark_safe

register = template.Library()


@register.filter
def kz(valor):
    """
    Formata um inteiro em Kwanzas: 78000 → "78 000 Kz".

    Usa espaço fino inquebrável (U+202F) como separador de milhares, para o
    número nunca se partir no fim de uma linha.
    """
    try:
        numero = int(valor or 0)
    except (TypeError, ValueError):
        return "0 Kz"
    return f"{numero:,}".replace(",", " ") + " Kz"


@register.filter
def tem(colecao, valor):
    """Pertença, para o template poder marcar filtros e tamanhos activos."""
    try:
        return valor in colecao
    except TypeError:
        return False


@register.simple_tag
def dados_estruturados(dados):
    """
    Escreve um bloco JSON-LD.

    Escapamos `<` para que uma descrição de produto não possa fechar a tag
    `</script>` e injectar código na página.
    """
    bruto = json.dumps(dados, ensure_ascii=False, default=str).replace("<", "\\u003c")
    return mark_safe(f'<script type="application/ld+json">{bruto}</script>')


@register.simple_tag(takes_context=True)
def url_com(context, **substituicoes):
    """
    Reescreve a query string mantendo o resto dos parâmetros.

    É o que permite clicar num filtro sem perder a pesquisa e a ordenação já
    escolhidas. Um valor vazio remove o parâmetro.
    """
    pedido = context["request"]
    params = pedido.GET.copy()

    for chave, valor in substituicoes.items():
        if valor in (None, "", []):
            params.pop(chave, None)
        else:
            params[chave] = valor

    # Mudar de filtro volta sempre à primeira página.
    params.pop("pagina", None)

    query = params.urlencode()
    return f"{pedido.path}?{query}" if query else pedido.path


@register.simple_tag(takes_context=True)
def alternar_na_query(context, chave, valor):
    """Acrescenta ou remove um valor de um parâmetro multivalor (marca, cor…)."""
    pedido = context["request"]
    params = pedido.GET.copy()

    actuais = params.getlist(chave)
    if valor in actuais:
        actuais.remove(valor)
    else:
        actuais.append(valor)

    params.setlist(chave, actuais)
    params.pop("pagina", None)

    query = params.urlencode()
    return f"{pedido.path}?{query}" if query else pedido.path


@register.filter
def indice(sequencia, posicao):
    try:
        return sequencia[posicao]
    except (IndexError, KeyError, TypeError):
        return None


@register.filter
def split(valor, separador=","):
    """Divide uma string — usado para listas curtas escritas no template."""
    return [p.strip() for p in str(valor).split(separador) if p.strip()]


@register.filter
def mult(valor, factor):
    """Multiplica; serve para escalonar os atrasos das animações de entrada."""
    try:
        return int(valor) * int(factor)
    except (TypeError, ValueError):
        return 0


@register.filter
def menos(valor, subtrair):
    try:
        return int(valor) - int(subtrair)
    except (TypeError, ValueError):
        return 0
