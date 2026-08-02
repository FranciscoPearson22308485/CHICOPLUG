"""Painel de administração desenhado à medida (o admin do Django está desligado)."""

from django.contrib.auth.decorators import user_passes_test
from django.db.models import Count, Sum
from django.shortcuts import render
from django.urls import reverse
from django.utils import timezone

from catalogo.models import Categoria, Marca, Produto
from contas.models import Utilizador
from encomendas.models import Encomenda, EstadoEncomenda
from encomendas.pagamentos import estado_integracao
from encomendas.services import alertas_de_stock

# O acesso é decidido pelo papel, não pelo `is_staff` do Django.
so_admin = user_passes_test(lambda u: u.is_authenticated and u.e_admin, login_url="contas:entrar")


def _menu(seccao):
    itens = [
        ("painel:dashboard", "Dashboard", "dashboard"),
        ("painel:produtos", "Produtos", "produtos"),
        ("painel:marcas", "Marcas", "marcas"),
        ("painel:categorias", "Categorias", "categorias"),
        ("painel:encomendas", "Encomendas", "encomendas"),
        ("painel:stock", "Stock", "stock"),
        ("painel:definicoes", "Configurações", "definicoes"),
    ]
    return {
        "menu_painel": [(reverse(nome), rotulo, chave) for nome, rotulo, chave in itens],
        "seccao": seccao,
    }


def _kz(valor):
    return f"{int(valor or 0):,}".replace(",", "\u202f") + " Kz"


@so_admin
def dashboard(request):
    ha_30_dias = timezone.now() - timezone.timedelta(days=30)
    # Encomendas canceladas não contam como receita.
    facturaveis = Encomenda.objects.exclude(estado=EstadoEncomenda.CANCELADA)
    periodo = facturaveis.filter(criado_em__gte=ha_30_dias).aggregate(
        receita=Sum("total"), total=Count("id")
    )

    hoje = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

    return render(request, "painel/dashboard.html", {
        **_menu("dashboard"),
        "titulo_painel": "Dashboard",
        "cartoes": [
            ("Vendas (30d)", _kz(periodo["receita"]), None),
            ("Encomendas", str(periodo["total"] or 0),
             f"+{Encomenda.objects.filter(criado_em__gte=hoje).count()} hoje"),
            ("Clientes", str(Utilizador.objects.filter(papel=Utilizador.Papel.CLIENTE).count()), None),
            ("Produtos activos", str(Produto.objects.filter(activo=True).count()), None),
        ],
        "recentes": Encomenda.objects.prefetch_related("itens")[:6],
        "alertas": alertas_de_stock()[:8],
    })


@so_admin
def produtos(request):
    return render(request, "painel/produtos.html", {
        **_menu("produtos"),
        "titulo_painel": "Produtos",
        "produtos": Produto.objects.completos().order_by("-criado_em")[:100],
    })


@so_admin
def marcas(request):
    return render(request, "painel/marcas.html", {
        **_menu("marcas"), "titulo_painel": "Marcas",
        "marcas": Marca.objects.com_contagem(),
    })


@so_admin
def categorias(request):
    return render(request, "painel/categorias.html", {
        **_menu("categorias"), "titulo_painel": "Categorias",
        "categorias": Categoria.objects.com_contagem(),
    })


@so_admin
def encomendas(request):
    lista = Encomenda.objects.prefetch_related("itens", "pagamentos")
    estado = request.GET.get("estado")
    if estado:
        lista = lista.filter(estado=estado)
    return render(request, "painel/encomendas.html", {
        **_menu("encomendas"), "titulo_painel": "Encomendas",
        "encomendas": lista[:100],
        "estados": EstadoEncomenda.choices,
        "estado_activo": estado,
    })


@so_admin
def stock(request):
    return render(request, "painel/stock.html", {
        **_menu("stock"), "titulo_painel": "Stock", "alertas": alertas_de_stock(),
    })


@so_admin
def definicoes(request):
    return render(request, "painel/definicoes.html", {
        **_menu("definicoes"), "titulo_painel": "Configurações",
        "integracao": estado_integracao(),
    })
