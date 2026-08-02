"""Painel de administração desenhado à medida (o admin do Django está desligado)."""

import csv

from django.contrib import messages
from django.contrib.auth.decorators import user_passes_test
from django.db import transaction
from django.db.models import Count, ProtectedError, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST

from catalogo.models import Avaliacao, Categoria, Marca, Produto, Variante
from contas.models import Utilizador
from encomendas.models import Cupao, Encomenda, EstadoEncomenda
from encomendas.pagamentos import estado_integracao
from encomendas.services import ErroDeNegocio, alertas_de_stock
from encomendas.services import mudar_estado as mudar_estado_encomenda

from .forms import CategoriaForm, CupaoForm, ImagemFormSet, MarcaForm, ProdutoForm, VarianteFormSet

# O acesso é decidido pelo papel, não pelo `is_staff` do Django.
so_admin = user_passes_test(lambda u: u.is_authenticated and u.e_admin, login_url="contas:entrar")


def _menu(seccao):
    itens = [
        ("painel:dashboard", "Dashboard", "dashboard"),
        ("painel:produtos", "Produtos", "produtos"),
        ("painel:marcas", "Marcas", "marcas"),
        ("painel:categorias", "Categorias", "categorias"),
        ("painel:cupoes", "Cupões", "cupoes"),
        ("painel:avaliacoes", "Avaliações", "avaliacoes"),
        ("painel:encomendas", "Encomendas", "encomendas"),
        ("painel:stock", "Stock", "stock"),
        ("painel:definicoes", "Configurações", "definicoes"),
    ]
    return {
        "menu_painel": [(reverse(nome), rotulo, chave) for nome, rotulo, chave in itens],
        "seccao": seccao,
    }


def _kz(valor):
    return f"{int(valor or 0):,}".replace(",", " ") + " Kz"


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


# ─── Produtos ─────────────────────────────────────────────────────────────────


@so_admin
def produtos(request):
    return render(request, "painel/produtos.html", {
        **_menu("produtos"),
        "titulo_painel": "Produtos",
        "produtos": Produto.objects.completos().order_by("-criado_em")[:100],
    })


class _FormsetInvalido(Exception):
    """Sinal interno para desfazer a transacção quando uma variante não valida."""


def _produto_form(request, produto):
    if request.method == "POST":
        form = ProdutoForm(request.POST, instance=produto)
        if form.is_valid():
            # Os formsets inline precisam de um produto com chave primária para
            # validarem, mas gravar antes de os validar deixaria um produto meio
            # criado — e voltar a submeter criaria um segundo. Gravamos dentro da
            # transacção e desfazemo-la se alguma linha não passar.
            try:
                with transaction.atomic():
                    objecto = form.save()
                    variantes_formset = VarianteFormSet(request.POST, instance=objecto, prefix="variantes")
                    imagens_formset = ImagemFormSet(
                        request.POST, request.FILES, instance=objecto, prefix="imagens"
                    )
                    if not (variantes_formset.is_valid() and imagens_formset.is_valid()):
                        raise _FormsetInvalido

                    variantes_formset.save()
                    imagens_formset.save()
                    messages.success(request, f'Produto "{objecto.nome}" guardado.')
                    return redirect("painel:produtos")
            except _FormsetInvalido:
                # Nada ficou gravado; os formsets já trazem os erros para o ecrã.
                messages.error(request, "Corrige os erros assinalados antes de guardar.")
        else:
            variantes_formset = VarianteFormSet(request.POST, instance=produto, prefix="variantes")
            imagens_formset = ImagemFormSet(request.POST, request.FILES, instance=produto, prefix="imagens")
    else:
        form = ProdutoForm(instance=produto)
        variantes_formset = VarianteFormSet(instance=produto, prefix="variantes")
        imagens_formset = ImagemFormSet(instance=produto, prefix="imagens")

    return render(request, "painel/produto_form.html", {
        **_menu("produtos"),
        "titulo_painel": "Editar produto" if produto else "Novo produto",
        "form": form,
        "variantes_formset": variantes_formset,
        "imagens_formset": imagens_formset,
        "produto": produto,
    })


@so_admin
def produto_novo(request):
    return _produto_form(request, produto=None)


@so_admin
def produto_editar(request, pk):
    return _produto_form(request, produto=get_object_or_404(Produto, pk=pk))


@so_admin
@require_POST
def produto_remover(request, pk):
    produto = get_object_or_404(Produto, pk=pk)
    nome = produto.nome
    produto.delete()
    messages.success(request, f'Produto "{nome}" removido.')
    return redirect("painel:produtos")


@so_admin
def produtos_exportar(request):
    resposta = HttpResponse(content_type="text/csv")
    resposta["Content-Disposition"] = 'attachment; filename="produtos.csv"'
    escritor = csv.writer(resposta)
    escritor.writerow(["Marca", "Produto", "Categoria", "Preço (Kz)", "Stock", "Activo"])
    for p in Produto.objects.completos().order_by("marca__nome", "nome"):
        escritor.writerow([p.marca.nome, p.nome, p.categoria.nome, p.preco, p.stock, "Sim" if p.activo else "Não"])
    return resposta


# ─── Marcas ───────────────────────────────────────────────────────────────────


@so_admin
def marcas(request):
    return render(request, "painel/marcas.html", {
        **_menu("marcas"), "titulo_painel": "Marcas",
        "marcas": Marca.objects.com_contagem(),
    })


def _marca_form(request, marca):
    form = MarcaForm(request.POST or None, request.FILES or None, instance=marca)
    if request.method == "POST" and form.is_valid():
        objecto = form.save()
        messages.success(request, f'Marca "{objecto.nome}" guardada.')
        return redirect("painel:marcas")
    return render(request, "painel/marca_form.html", {
        **_menu("marcas"), "titulo_painel": "Editar marca" if marca else "Nova marca", "form": form,
    })


@so_admin
def marca_nova(request):
    return _marca_form(request, marca=None)


@so_admin
def marca_editar(request, pk):
    return _marca_form(request, marca=get_object_or_404(Marca, pk=pk))


@so_admin
@require_POST
def marca_remover(request, pk):
    marca = get_object_or_404(Marca, pk=pk)
    try:
        marca.delete()
        messages.success(request, f'Marca "{marca.nome}" removida.')
    except ProtectedError:
        messages.error(request, f'Não é possível remover "{marca.nome}": há peças associadas a esta marca.')
    return redirect("painel:marcas")


# ─── Categorias ───────────────────────────────────────────────────────────────


@so_admin
def categorias(request):
    return render(request, "painel/categorias.html", {
        **_menu("categorias"), "titulo_painel": "Categorias",
        "categorias": Categoria.objects.com_contagem(),
    })


def _categoria_form(request, categoria):
    form = CategoriaForm(request.POST or None, instance=categoria)
    if request.method == "POST" and form.is_valid():
        objecto = form.save()
        messages.success(request, f'Categoria "{objecto.nome}" guardada.')
        return redirect("painel:categorias")
    return render(request, "painel/categoria_form.html", {
        **_menu("categorias"), "titulo_painel": "Editar categoria" if categoria else "Nova categoria",
        "form": form,
    })


@so_admin
def categoria_nova(request):
    return _categoria_form(request, categoria=None)


@so_admin
def categoria_editar(request, pk):
    return _categoria_form(request, categoria=get_object_or_404(Categoria, pk=pk))


@so_admin
@require_POST
def categoria_remover(request, pk):
    categoria = get_object_or_404(Categoria, pk=pk)
    try:
        categoria.delete()
        messages.success(request, f'Categoria "{categoria.nome}" removida.')
    except ProtectedError:
        messages.error(request, f'Não é possível remover "{categoria.nome}": há peças associadas a esta categoria.')
    return redirect("painel:categorias")


# ─── Cupões ───────────────────────────────────────────────────────────────────


@so_admin
def cupoes(request):
    return render(request, "painel/cupoes.html", {
        **_menu("cupoes"), "titulo_painel": "Cupões",
        "cupoes": Cupao.objects.all(),
    })


def _cupao_form(request, cupao):
    form = CupaoForm(request.POST or None, instance=cupao)
    if request.method == "POST" and form.is_valid():
        objecto = form.save()
        messages.success(request, f'Cupão "{objecto.codigo}" guardado.')
        return redirect("painel:cupoes")
    return render(request, "painel/cupao_form.html", {
        **_menu("cupoes"), "titulo_painel": "Editar cupão" if cupao else "Novo cupão", "form": form,
    })


@so_admin
def cupao_novo(request):
    return _cupao_form(request, cupao=None)


@so_admin
def cupao_editar(request, pk):
    return _cupao_form(request, cupao=get_object_or_404(Cupao, pk=pk))


@so_admin
@require_POST
def cupao_remover(request, pk):
    cupao = get_object_or_404(Cupao, pk=pk)
    codigo = cupao.codigo
    cupao.delete()
    messages.success(request, f'Cupão "{codigo}" removido.')
    return redirect("painel:cupoes")


# ─── Avaliações ───────────────────────────────────────────────────────────────


@so_admin
def avaliacoes(request):
    lista = Avaliacao.objects.completas().select_related("produto", "produto__marca")

    # Por omissão mostramos tudo; o filtro serve para despachar a moderação.
    estado = request.GET.get("estado")
    if estado == "publicadas":
        lista = lista.filter(publicada=True)
    elif estado == "escondidas":
        lista = lista.filter(publicada=False)

    return render(request, "painel/avaliacoes.html", {
        **_menu("avaliacoes"), "titulo_painel": "Avaliações",
        "avaliacoes": lista[:200],
        "estado_activo": estado,
        "total_escondidas": Avaliacao.objects.filter(publicada=False).count(),
    })


@so_admin
@require_POST
def avaliacao_alternar(request, pk):
    """Publica ou esconde. Uma avaliação escondida deixa de contar para a média."""
    avaliacao = get_object_or_404(Avaliacao, pk=pk)
    avaliacao.publicada = not avaliacao.publicada
    avaliacao.save(update_fields=["publicada", "actualizado_em"])
    messages.success(
        request,
        "Avaliação publicada." if avaliacao.publicada else "Avaliação escondida da loja.",
    )
    return redirect(request.POST.get("voltar_para") or "painel:avaliacoes")


@so_admin
@require_POST
def avaliacao_remover(request, pk):
    avaliacao = get_object_or_404(Avaliacao, pk=pk)
    avaliacao.delete()
    messages.success(request, "Avaliação removida.")
    return redirect("painel:avaliacoes")


# ─── Encomendas ───────────────────────────────────────────────────────────────


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
@require_POST
def encomenda_mudar_estado(request, referencia):
    encomenda = get_object_or_404(Encomenda, referencia=referencia)
    novo_estado = request.POST.get("estado", "")

    # Um estado fora das escolhas rebentaria dentro de mudar_estado, ao compor a
    # mensagem de erro com EstadoEncomenda(novo_estado).
    if novo_estado not in EstadoEncomenda.values:
        messages.error(request, "Estado desconhecido.")
        return redirect("painel:encomendas")

    try:
        mudar_estado_encomenda(encomenda, novo_estado, autor=request.user, nota="Alterado no painel.")
        messages.success(request, f"Encomenda {referencia}: estado actualizado.")
    except ErroDeNegocio as erro:
        messages.error(request, str(erro))
    return redirect("painel:encomendas")


@so_admin
def encomendas_exportar(request):
    resposta = HttpResponse(content_type="text/csv")
    resposta["Content-Disposition"] = 'attachment; filename="encomendas.csv"'
    escritor = csv.writer(resposta)
    escritor.writerow(["Referência", "Cliente", "Email", "Total (Kz)", "Estado", "Criada em"])
    for e in Encomenda.objects.all():
        escritor.writerow([
            e.referencia, e.nome_cliente, e.email, e.total,
            e.get_estado_display(), e.criado_em.strftime("%Y-%m-%d %H:%M"),
        ])
    return resposta


# ─── Stock ────────────────────────────────────────────────────────────────────


@so_admin
def stock(request):
    return render(request, "painel/stock.html", {
        **_menu("stock"), "titulo_painel": "Stock", "alertas": alertas_de_stock(),
    })


@so_admin
@require_POST
def stock_ajustar(request):
    """Ajuste em lote: cada campo `stock_<id>` do formulário é uma variante."""
    actualizados = 0
    for chave, valor in request.POST.items():
        if not chave.startswith("stock_"):
            continue

        # O identificador vem do nome do campo, por isso é entrada do cliente:
        # sem este teste, `stock_abc` faria a consulta rebentar.
        identificador = chave.removeprefix("stock_")
        if not identificador.isdigit():
            continue

        try:
            novo_stock = int(valor)
        except ValueError:
            continue
        if novo_stock < 0:
            continue

        actualizados += Variante.objects.filter(pk=identificador).update(stock=novo_stock)

    messages.success(request, f"Stock actualizado em {actualizados} variante(s).")
    return redirect("painel:stock")


# ─── Configurações ────────────────────────────────────────────────────────────


@so_admin
def definicoes(request):
    return render(request, "painel/definicoes.html", {
        **_menu("definicoes"), "titulo_painel": "Configurações",
        "integracao": estado_integracao(),
    })
