from django.contrib import messages
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import PasswordChangeForm
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from catalogo.models import Favorito, Produto
from encomendas.services import fundir_carrinho_anonimo

from .models import Morada, Utilizador


def entrar(request):
    if request.user.is_authenticated:
        return redirect("contas:perfil")

    if request.method == "POST":
        email = request.POST.get("email", "").strip().lower()
        password = request.POST.get("password", "")
        utilizador = authenticate(request, username=email, password=password)

        if utilizador:
            login(request, utilizador)
            # O carrinho montado antes do login não pode desaparecer.
            fundir_carrinho_anonimo(request, utilizador)
            messages.success(request, f"Bem-vindo de volta, {utilizador.primeiro_nome}.")
            destino = request.GET.get("next") or (
                "painel:dashboard" if utilizador.e_admin else "contas:perfil"
            )
            return redirect(destino if destino.startswith("/") else destino)

        messages.error(request, "Email ou password incorrectos.")

    return render(request, "contas/entrar.html")


def registar(request):
    if request.user.is_authenticated:
        return redirect("contas:perfil")

    if request.method == "POST":
        dados = {c: request.POST.get(c, "").strip() for c in ("nome", "apelido", "email", "telefone")}
        password = request.POST.get("password", "")
        erros = {}

        if not dados["nome"]:
            erros["nome"] = "Indica o teu nome."
        if not dados["apelido"]:
            erros["apelido"] = "Indica o teu apelido."
        if "@" not in dados["email"]:
            erros["email"] = "Email inválido."
        elif Utilizador.objects.filter(email__iexact=dados["email"]).exists():
            erros["email"] = "Já existe uma conta com este email."

        try:
            validate_password(password)
        except ValidationError as erro:
            erros["password"] = " ".join(erro.messages)

        if not erros:
            utilizador = Utilizador.objects.create_user(
                email=dados["email"],
                password=password,
                primeiro_nome=dados["nome"],
                apelido=dados["apelido"],
                telefone=dados["telefone"],
            )
            login(request, utilizador, backend="contas.backends.EmailBackend")
            fundir_carrinho_anonimo(request, utilizador)
            messages.success(request, f"Conta criada. Bem-vindo, {utilizador.primeiro_nome}.")
            return redirect("contas:perfil")

        return render(request, "contas/registar.html", {"erros": erros, "dados": dados})

    return render(request, "contas/registar.html", {"erros": {}, "dados": {}})


def sair(request):
    logout(request)
    messages.success(request, "Sessão terminada.")
    return redirect("catalogo:home")


@login_required
def perfil(request):
    if request.method == "POST":
        u = request.user
        u.primeiro_nome = request.POST.get("nome", u.primeiro_nome).strip()
        u.apelido = request.POST.get("apelido", u.apelido).strip()
        u.telefone = request.POST.get("telefone", "").strip()
        u.aceita_marketing = request.POST.get("marketing") == "on"
        u.save()
        messages.success(request, "Perfil actualizado.")
        return redirect("contas:perfil")

    from encomendas.models import Encomenda

    return render(
        request,
        "contas/perfil.html",
        {
            "total_encomendas": Encomenda.objects.filter(utilizador=request.user).count(),
            "total_favoritos": request.user.favoritos.count(),
        },
    )


@login_required
def alterar_password(request):
    formulario = PasswordChangeForm(request.user, request.POST or None)
    if request.method == "POST" and formulario.is_valid():
        utilizador = formulario.save()
        # Sem isto o Django invalida a sessão e expulsa quem acabou de mudar.
        update_session_auth_hash(request, utilizador)
        messages.success(request, "Password actualizada.")
        return redirect("contas:perfil")
    return render(request, "contas/alterar_password.html", {"formulario": formulario})


@login_required
def favoritos(request):
    produtos = Produto.objects.completos().filter(
        favoritado_por__utilizador=request.user, activo=True
    )
    return render(request, "contas/favoritos.html", {"produtos": produtos})


@require_POST
def alternar_favorito(request):
    if not request.user.is_authenticated:
        return JsonResponse({"autenticacao_necessaria": True})

    produto = get_object_or_404(Produto, pk=request.POST.get("produto"), activo=True)
    favorito = Favorito.objects.filter(utilizador=request.user, produto=produto).first()

    if favorito:
        favorito.delete()
        return JsonResponse({"adicionado": False})

    Favorito.objects.create(utilizador=request.user, produto=produto)
    return JsonResponse({"adicionado": True})


@login_required
def moradas(request):
    from encomendas.views import MUNICIPIOS, PROVINCIAS

    if request.method == "POST":
        campos = {c: request.POST.get(c, "").strip() for c in
                  ("etiqueta", "destinatario", "telefone", "provincia", "municipio", "rua", "observacoes")}
        if all(campos[c] for c in ("etiqueta", "destinatario", "telefone", "provincia", "municipio", "rua")):
            primeira = not request.user.moradas.exists()
            morada = Morada.objects.create(utilizador=request.user, **campos,
                                           principal=primeira or request.POST.get("principal") == "on")
            if morada.principal:
                morada.tornar_principal()
            messages.success(request, "Morada adicionada.")
        else:
            messages.error(request, "Preenche todos os campos obrigatórios.")
        return redirect("contas:moradas")

    return render(request, "contas/moradas.html",
                  {"moradas": request.user.moradas.all(), "provincias": PROVINCIAS, "municipios": MUNICIPIOS})


@login_required
@require_POST
def remover_morada(request, pk):
    morada = get_object_or_404(Morada, pk=pk, utilizador=request.user)
    era_principal = morada.principal
    morada.delete()
    # Se removemos a principal, promovemos a mais antiga que reste.
    if era_principal:
        seguinte = request.user.moradas.order_by("criado_em").first()
        if seguinte:
            seguinte.tornar_principal()
    messages.success(request, "Morada removida.")
    return redirect("contas:moradas")
