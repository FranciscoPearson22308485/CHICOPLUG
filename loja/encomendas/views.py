from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from catalogo.models import Variante

from . import services
from .models import Cupao, Encomenda


def _json_ou_redireccao(request, carrinho, mensagem):
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        return JsonResponse({"ok": True, "mensagem": mensagem, "total_pecas": carrinho.total_pecas})
    messages.success(request, mensagem)
    return redirect("encomendas:carrinho")


def _erro(request, mensagem, estado=400):
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        return JsonResponse({"ok": False, "mensagem": mensagem}, status=estado)
    messages.error(request, mensagem)
    return redirect("encomendas:carrinho")


@require_POST
def adicionar(request):
    variante = get_object_or_404(Variante, pk=request.POST.get("variante"))
    try:
        quantidade = max(1, min(20, int(request.POST.get("quantidade", 1))))
    except ValueError:
        quantidade = 1

    try:
        carrinho = services.adicionar_ao_carrinho(request, variante, quantidade)
    except services.ErroDeNegocio as erro:
        return _erro(request, str(erro))

    return _json_ou_redireccao(request, carrinho, "Adicionado ao carrinho")


@require_POST
def actualizar(request, item_id):
    try:
        carrinho = services.actualizar_quantidade(request, item_id, int(request.POST.get("quantidade", 1)))
    except (services.ErroDeNegocio, ValueError) as erro:
        return _erro(request, str(erro))
    return _json_ou_redireccao(request, carrinho, "Carrinho actualizado")


@require_POST
def remover(request, item_id):
    carrinho = services.remover_do_carrinho(request, item_id)
    return _json_ou_redireccao(request, carrinho, "Peça removida")


def carrinho(request):
    actual = services.obter_carrinho(request, criar=False)
    return render(request, "encomendas/carrinho.html", {"carrinho_actual": actual})


def checkout(request):
    actual = services.obter_carrinho(request, criar=False)
    if not actual or not actual.itens.exists():
        return render(request, "encomendas/checkout_vazio.html")

    cupao, desconto, erro_cupao = None, 0, None
    codigo = (request.POST.get("cupao") or request.GET.get("cupao") or "").strip().upper()
    if codigo:
        cupao = Cupao.objects.filter(codigo=codigo).first()
        if not cupao:
            erro_cupao = "Cupão inválido."
        else:
            erro_cupao = cupao.erro_para(actual.subtotal)
            if erro_cupao:
                cupao = None
            else:
                desconto = cupao.desconto_para(actual.subtotal)

    if request.method == "POST" and request.POST.get("accao") == "finalizar":
        dados = {
            "nome_cliente": request.POST.get("nome", "").strip(),
            "email": request.POST.get("email", "").strip(),
            "telefone": request.POST.get("telefone", "").strip(),
            "provincia": request.POST.get("provincia", "").strip(),
            "municipio": request.POST.get("municipio", "").strip(),
            "rua": request.POST.get("rua", "").strip(),
            "observacoes": request.POST.get("observacoes", "").strip(),
        }
        em_falta = [c for c, v in dados.items() if not v and c != "observacoes"]
        if em_falta:
            messages.error(request, "Preenche todos os campos obrigatórios.")
        else:
            try:
                encomenda = services.criar_encomenda(request, dados, cupao)
                from .pagamentos import iniciar_pagamento

                iniciar_pagamento(encomenda)
                return redirect("encomendas:pagamento", referencia=encomenda.referencia)
            except services.ErroDeNegocio as erro:
                messages.error(request, str(erro))

    from django.conf import settings

    return render(
        request,
        "encomendas/checkout.html",
        {
            "carrinho_actual": actual,
            "cupao": cupao,
            "desconto": desconto,
            "erro_cupao": erro_cupao,
            "total_final": actual.subtotal - desconto + actual.envio,
            "provincias": PROVINCIAS,
            "municipios": MUNICIPIOS,
            "prazos_entrega": {
                p: services.previsao_de_entrega(p)["texto"] for p in PROVINCIAS
            },
        },
    )


def pagamento(request, referencia):
    encomenda = get_object_or_404(Encomenda, referencia=referencia)
    return render(request, "encomendas/pagamento.html", {"encomenda": encomenda})


def estado_pagamento(request, referencia):
    """Consultado por polling enquanto o cliente confirma na app do banco."""
    encomenda = get_object_or_404(Encomenda, referencia=referencia)
    pag = encomenda.pagamento_actual
    return JsonResponse(
        {
            "estado_pagamento": pag.estado if pag else None,
            "estado_encomenda": encomenda.estado,
            "motivo": pag.motivo_falha if pag else "",
        }
    )


@require_POST
def simular_pagamento(request, referencia):
    """Reproduz a confirmação na app Multicaixa. Bloqueado em produção."""
    from django.conf import settings

    if not settings.DEBUG:
        return JsonResponse({"ok": False, "mensagem": "Indisponível em produção."}, status=403)

    encomenda = get_object_or_404(Encomenda, referencia=referencia)
    pag = encomenda.pagamento_actual
    if not pag:
        return JsonResponse({"ok": False, "mensagem": "Sem pagamento activo."}, status=404)

    services.aplicar_resultado_pagamento(pag, request.POST.get("estado", "PAGO"))
    return JsonResponse({"ok": True})


@login_required
def minhas_encomendas(request):
    encomendas = (
        Encomenda.objects.filter(utilizador=request.user).prefetch_related("itens", "pagamentos")
    )
    return render(request, "encomendas/minhas.html", {"encomendas": encomendas})


@login_required
def detalhe(request, referencia):
    encomenda = get_object_or_404(
        Encomenda.objects.prefetch_related("itens", "eventos"),
        referencia=referencia,
        utilizador=request.user,
    )
    return render(request, "encomendas/detalhe.html", {"encomenda": encomenda})


@login_required
@require_POST
def cancelar(request, referencia):
    encomenda = get_object_or_404(Encomenda, referencia=referencia, utilizador=request.user)
    if not encomenda.cancelavel_pelo_cliente:
        messages.error(request, "Esta encomenda já está em preparação. Contacta-nos.")
    else:
        try:
            services.mudar_estado(encomenda, "CANCELADA", autor=request.user, nota="Cancelada pelo cliente.")
            messages.success(request, f"Encomenda {referencia} cancelada.")
        except services.ErroDeNegocio as erro:
            messages.error(request, str(erro))
    return redirect("encomendas:minhas")


PROVINCIAS = ["Luanda", "Benguela", "Huíla", "Huambo", "Cabinda", "Namibe", "Malanje", "Uíge"]

MUNICIPIOS = {
    "Luanda": ["Belas", "Cacuaco", "Cazenga", "Icolo e Bengo", "Luanda", "Talatona", "Viana"],
    "Benguela": ["Benguela", "Catumbela", "Lobito", "Baía Farta"],
    "Huíla": ["Lubango", "Humpata", "Matala"],
    "Huambo": ["Huambo", "Caála", "Bailundo"],
    "Cabinda": ["Cabinda", "Cacongo"],
    "Namibe": ["Moçâmedes", "Tômbwa"],
    "Malanje": ["Malanje", "Cacuso"],
    "Uíge": ["Uíge", "Negage"],
}
