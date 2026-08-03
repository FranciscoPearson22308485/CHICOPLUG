"""
Agregações do painel — dashboard executivo e relatórios.

Tudo aqui sai de dados reais. Quando uma métrica não é calculável com o que a
base guarda, é devolvida como `None` e o ecrã diz porquê, em vez de mostrar um
número inventado. Hoje é o caso da taxa de conversão e do produto mais visto:
ambos precisam de registo de visitas, que ainda não existe.
"""

from django.db.models import Avg, Count, F, Q, Sum
from django.utils import timezone

from catalogo.models import Produto, Variante
from contas.models import Utilizador
from encomendas.models import Carrinho, Encomenda, EstadoEncomenda, ItemEncomenda

# Encomendas canceladas não são receita.
FACTURAVEIS = ~Q(estado=EstadoEncomenda.CANCELADA)


def _encomendas(desde=None, ate=None):
    lista = Encomenda.objects.filter(FACTURAVEIS)
    if desde:
        lista = lista.filter(criado_em__gte=desde)
    if ate:
        lista = lista.filter(criado_em__lt=ate)
    return lista


def _itens(desde=None, ate=None):
    lista = ItemEncomenda.objects.exclude(encomenda__estado=EstadoEncomenda.CANCELADA)
    if desde:
        lista = lista.filter(encomenda__criado_em__gte=desde)
    if ate:
        lista = lista.filter(encomenda__criado_em__lt=ate)
    return lista


# ─── Dashboard ────────────────────────────────────────────────────────────────


def resumo(dias=30):
    """Números do dashboard executivo para os últimos `dias` dias."""
    agora = timezone.now()
    desde = agora - timezone.timedelta(days=dias)
    hoje = agora.replace(hour=0, minute=0, second=0, microsecond=0)
    semana = agora - timezone.timedelta(days=7)
    mes = agora - timezone.timedelta(days=30)

    periodo = _encomendas(desde).aggregate(
        receita=Sum("total"), encomendas=Count("id"), ticket=Avg("total")
    )
    itens = _itens(desde).aggregate(unidades=Sum("quantidade"))

    return {
        "receita": periodo["receita"] or 0,
        "encomendas": periodo["encomendas"] or 0,
        "ticket_medio": int(periodo["ticket"] or 0),
        "unidades": itens["unidades"] or 0,
        "receita_semana": _encomendas(semana).aggregate(t=Sum("total"))["t"] or 0,
        "receita_mes": _encomendas(mes).aggregate(t=Sum("total"))["t"] or 0,
        "encomendas_hoje": Encomenda.objects.filter(criado_em__gte=hoje).count(),
        **margem(desde),
        **clientes(desde),
        "pendentes": Encomenda.objects.filter(
            estado__in=[EstadoEncomenda.NOVA, EstadoEncomenda.CONFIRMADA, EstadoEncomenda.EM_PREPARACAO]
        ).count(),
        "enviadas": Encomenda.objects.filter(estado=EstadoEncomenda.ENVIADA).count(),
        "stock_critico": _stock_critico(),
        "carrinhos_abandonados": carrinhos_abandonados(),
        # Precisam de registo de visitas, que ainda não existe. `None` faz o
        # ecrã explicar a ausência em vez de mostrar um zero enganador.
        "taxa_conversao": None,
        "produto_mais_visto": None,
    }


def margem(desde=None):
    """
    Lucro e margem, contando apenas as linhas de peças com custo conhecido.

    Misturar peças sem custo baixaria artificialmente a margem, por isso o
    resultado diz sempre sobre que fatia das vendas foi calculado.
    """
    linhas = _itens(desde).filter(variante__produto__preco_custo__isnull=False).annotate(
        custo_linha=F("variante__produto__preco_custo") * F("quantidade")
    )
    dados = linhas.aggregate(receita=Sum("total_linha"), custo=Sum("custo_linha"))

    receita = dados["receita"] or 0
    custo = dados["custo"] or 0
    total_geral = _itens(desde).aggregate(t=Sum("total_linha"))["t"] or 0

    if not receita:
        return {"lucro": None, "margem": None, "cobertura_custo": 0}

    return {
        "lucro": receita - custo,
        "margem": round((receita - custo) / receita * 100, 1),
        # Percentagem da facturação que tem custo registado.
        "cobertura_custo": round(receita / total_geral * 100) if total_geral else 0,
    }


def clientes(desde=None):
    novos = Utilizador.objects.filter(papel=Utilizador.Papel.CLIENTE)
    if desde:
        novos = novos.filter(criado_em__gte=desde)

    # Recorrente = com mais de uma encomenda facturável.
    recorrentes = (
        _encomendas()
        .filter(utilizador__isnull=False)
        .values("utilizador")
        .annotate(n=Count("id"))
        .filter(n__gt=1)
        .count()
    )
    return {
        "clientes_novos": novos.count(),
        "clientes_recorrentes": recorrentes,
        "clientes_total": Utilizador.objects.filter(papel=Utilizador.Papel.CLIENTE).count(),
    }


def carrinhos_abandonados(horas=24):
    """
    Carrinhos com peças que não mexem há mais de `horas`.

    É a definição possível sem registo de sessões: um carrinho parado há um dia
    é, na prática, uma compra que não se concretizou.
    """
    limite = timezone.now() - timezone.timedelta(hours=horas)
    return (
        Carrinho.objects.filter(itens__isnull=False, actualizado_em__lt=limite)
        .distinct()
        .count()
    )


def _stock_critico():
    return Variante.objects.filter(
        activa=True, produto__activo=True, stock__lte=F("limiar_stock_baixo")
    ).count()


# ─── Cortes ───────────────────────────────────────────────────────────────────


def por_marca(desde=None, ate=None, limite=None):
    lista = (
        _itens(desde, ate)
        .values("marca")
        .annotate(receita=Sum("total_linha"), unidades=Sum("quantidade"), linhas=Count("id"))
        .order_by("-receita")
    )
    return list(lista[:limite] if limite else lista)


def por_categoria(desde=None, ate=None, limite=None):
    lista = (
        _itens(desde, ate)
        .filter(variante__produto__categoria__isnull=False)
        .values(nome=F("variante__produto__categoria__nome"))
        .annotate(receita=Sum("total_linha"), unidades=Sum("quantidade"))
        .order_by("-receita")
    )
    return list(lista[:limite] if limite else lista)


def por_produto(desde=None, ate=None, limite=None):
    lista = (
        _itens(desde, ate)
        .values("marca", "nome_produto", "slug_produto")
        .annotate(receita=Sum("total_linha"), unidades=Sum("quantidade"))
        .order_by("-receita")
    )
    return list(lista[:limite] if limite else lista)


def por_cidade(desde=None, ate=None, limite=None):
    lista = (
        _encomendas(desde, ate)
        .values("provincia", "municipio")
        .annotate(receita=Sum("total"), encomendas=Count("id"))
        .order_by("-receita")
    )
    return list(lista[:limite] if limite else lista)


def por_cliente(desde=None, ate=None, limite=None):
    lista = (
        _encomendas(desde, ate)
        .values("nome_cliente", "email")
        .annotate(receita=Sum("total"), encomendas=Count("id"))
        .order_by("-receita")
    )
    return list(lista[:limite] if limite else lista)


def por_dia(dias=30):
    """Receita diária, com os dias sem vendas a zero — senão o gráfico mente."""
    agora = timezone.now()
    inicio = (agora - timezone.timedelta(days=dias - 1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    vendas = {}
    for encomenda in _encomendas(inicio).values("criado_em", "total"):
        chave = timezone.localtime(encomenda["criado_em"]).date()
        vendas[chave] = vendas.get(chave, 0) + encomenda["total"]

    serie = []
    for n in range(dias):
        dia = (inicio + timezone.timedelta(days=n)).date()
        serie.append({"dia": dia, "receita": vendas.get(dia, 0)})
    return serie


def escalar(serie, campo="receita"):
    """Altura relativa de cada barra, em percentagem do maior valor da série."""
    maximo = max((l[campo] or 0) for l in serie) if serie else 0
    for linha in serie:
        linha["altura"] = round((linha[campo] or 0) / maximo * 100) if maximo else 0
    return serie


def com_percentagem(linhas, campo="receita"):
    """Acrescenta a percentagem do total a cada linha, para desenhar as barras."""
    total = sum(l[campo] or 0 for l in linhas)
    for linha in linhas:
        linha["percentagem"] = round((linha[campo] or 0) / total * 100) if total else 0
    return linhas
