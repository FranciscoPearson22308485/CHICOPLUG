from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Count, Max, Min, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from . import services
from .models import Categoria, Marca, Produto, Subscritor, Variante

TAMANHO_PAGINA = 24

ORDENACOES = [
    ("novidades", "Novidades"),
    ("preco-asc", "Preço ↑"),
    ("preco-desc", "Preço ↓"),
    ("marca", "Marca"),
    ("nome", "A–Z"),
]

ORDENS_SQL = {
    "preco-asc": ["preco", "nome"],
    "preco-desc": ["-preco", "nome"],
    "nome": ["nome"],
    "marca": ["marca__nome", "nome"],
    "novidades": ["-novidade", "-criado_em"],
}


def home(request):
    """
    Montra da loja.

    Uma consulta por secção, todas com `completos()` para não disparar centenas
    de consultas ao renderizar os cards.
    """
    activos = Produto.objects.activos().completos()

    contexto = {
        "novidades": activos.filter(novidade=True)[:8],
        "marcas_destaque": Marca.objects.em_destaque().com_contagem()[:8],
        "mais_vendidos": activos.filter(mais_vendido=True)[:4],
        "categorias": Categoria.objects.activas().com_contagem(),
        "promocoes": activos.filter(preco_anterior__isnull=False)[:4],
        "dados_json": {
            "@context": "https://schema.org",
            "@type": "Store",
            "name": "CHICOPLUG",
            "url": settings.SITE_URL,
            "description": "Boutique de streetwear premium em Luanda. As melhores marcas internacionais num só lugar.",
            "address": {"@type": "PostalAddress", "addressLocality": "Luanda", "addressCountry": "AO"},
        },
    }
    return render(request, "catalogo/home.html", contexto)


def _facetas():
    """
    Descreve o catálogo **inteiro**, não o resultado filtrado.

    Se as facetas fossem calculadas sobre o resultado, escolher "Nike" faria
    desaparecer todas as outras marcas e o utilizador ficava sem forma de mudar
    de ideias.
    """
    marcas = [
        m for m in Marca.objects.activas().com_contagem() if m.total_produtos > 0
    ]
    categorias = [
        c for c in Categoria.objects.activas().com_contagem() if c.total_produtos > 0
    ]

    variantes = (
        Variante.objects.filter(activa=True, produto__activo=True)
        .values("tamanho", "cor_nome", "cor_hex")
        .distinct()
    )

    tamanhos, cores, vistas = [], [], set()
    for v in variantes:
        if v["tamanho"] not in tamanhos:
            tamanhos.append(v["tamanho"])
        if v["cor_nome"] not in vistas:
            vistas.add(v["cor_nome"])
            cores.append({"nome": v["cor_nome"], "hex": v["cor_hex"]})

    precos = Produto.objects.activos().aggregate(min=Min("preco"), max=Max("preco"))

    return {
        "marcas": marcas,
        "categorias": categorias,
        "tamanhos": tamanhos,
        "cores": cores,
        "preco_min": precos["min"] or 0,
        "preco_max": precos["max"] or 250000,
    }


def shop(request, base=None, extra=None):
    """
    Catálogo com os seis filtros, ordenação e paginação.

    `base` e `extra` existem para as Promoções e as Novidades reutilizarem
    exactamente esta listagem — mesmos filtros, mesma ordenação, mesmo
    desenho — mudando só o conjunto de partida e os textos do cabeçalho.
    Ambos têm valor por omissão, por isso o Shop continua a ser `shop(request)`.
    """
    facetas = _facetas()
    produtos = base if base is not None else Produto.objects.activos().completos()

    pesquisa = request.GET.get("pesquisa", "").strip()
    marcas_sel = request.GET.getlist("marca")
    categorias_sel = request.GET.getlist("categoria")
    tamanhos_sel = request.GET.getlist("tamanho")
    cores_sel = request.GET.getlist("cor")
    preco_max = request.GET.get("preco_max", "")
    so_stock = request.GET.get("stock") == "1"
    so_promo = request.GET.get("promocao") == "1"
    ordenar = request.GET.get("ordenar", "novidades")

    if pesquisa:
        # Cobre os três eixos que um cliente de boutique usa naturalmente.
        produtos = produtos.filter(
            Q(nome__icontains=pesquisa)
            | Q(descricao__icontains=pesquisa)
            | Q(marca__nome__icontains=pesquisa)
            | Q(categoria__nome__icontains=pesquisa)
        )

    if marcas_sel:
        produtos = produtos.filter(marca__slug__in=marcas_sel)
    if categorias_sel:
        produtos = produtos.filter(categoria__slug__in=categorias_sel)
    if tamanhos_sel:
        produtos = produtos.filter(
            variantes__tamanho__in=tamanhos_sel, variantes__activa=True
        ).distinct()
    if cores_sel:
        produtos = produtos.filter(
            variantes__cor_nome__in=cores_sel, variantes__activa=True
        ).distinct()

    if preco_max.isdigit():
        produtos = produtos.filter(preco__lte=int(preco_max))
    if so_stock:
        produtos = produtos.filter(variantes__stock__gt=0, variantes__activa=True).distinct()
    if so_promo:
        produtos = produtos.filter(preco_anterior__isnull=False)

    produtos = produtos.order_by(*ORDENS_SQL.get(ordenar, ORDENS_SQL["novidades"]))

    paginador = Paginator(produtos, TAMANHO_PAGINA)
    pagina = paginador.get_page(request.GET.get("pagina"))

    filtros_activos = (
        len(marcas_sel) + len(categorias_sel) + len(tamanhos_sel) + len(cores_sel)
        + (1 if preco_max.isdigit() and int(preco_max) < facetas["preco_max"] else 0)
        + (1 if so_stock else 0)
        + (1 if so_promo else 0)
    )

    contexto = {
        "pagina": pagina,
        "produtos": pagina.object_list,
        "total": paginador.count,
        "facetas": facetas,
        "ordenacoes": ORDENACOES,
        "pesquisa": pesquisa,
        "marcas_sel": marcas_sel,
        "categorias_sel": categorias_sel,
        "tamanhos_sel": tamanhos_sel,
        "cores_sel": cores_sel,
        "preco_max": int(preco_max) if preco_max.isdigit() else facetas["preco_max"],
        "so_stock": so_stock,
        "so_promo": so_promo,
        "ordenar": ordenar,
        "filtros_activos": filtros_activos,
    }
    contexto.update(extra or {})
    return render(request, "catalogo/shop.html", contexto)


def promocoes(request):
    """Só as peças com preço anterior — as que estão mesmo mais baratas."""
    return shop(
        request,
        base=Produto.objects.em_promocao().completos(),
        extra={
            "titulo_pagina": "Promoções",
            "eyebrow_pagina": "Preços reduzidos",
            "intro_pagina": "Peças com desconto real sobre o preço anterior. "
                            "Enquanto houver stock.",
            "descricao_pagina": "Streetwear premium em promoção na CHICOPLUG: "
                                "Nike, Jordan, Adidas, Corteiz e mais, com desconto real.",
        },
    )


def novidades(request):
    """As últimas entradas — por data de criação, não por marcação manual."""
    return shop(
        request,
        base=Produto.objects.activos().completos().order_by("-criado_em"),
        extra={
            "titulo_pagina": "Novidades",
            "eyebrow_pagina": "Últimas entradas",
            "intro_pagina": "As peças que chegaram há menos tempo à loja.",
            "descricao_pagina": "As novidades da CHICOPLUG: as últimas peças de "
                                "streetwear premium a entrar na loja.",
        },
    )


def produto(request, slug):
    peca = get_object_or_404(
        Produto.objects.completos().filter(activo=True), slug=slug
    )

    # Relacionados: mesma marca primeiro, depois mesma categoria.
    relacionados = list(
        Produto.objects.activos().completos().filter(marca=peca.marca).exclude(pk=peca.pk)[:3]
    )
    if len(relacionados) < 3:
        extra = (
            Produto.objects.activos()
            .completos()
            .filter(categoria=peca.categoria)
            .exclude(pk__in=[peca.pk] + [p.pk for p in relacionados])[: 3 - len(relacionados)]
        )
        relacionados.extend(extra)

    cor_inicial = peca.cores[0]["nome"] if peca.cores else ""

    # Mapa (cor → tamanhos com stock) para o JavaScript desactivar as
    # combinações impossíveis sem ir ao servidor a cada clique.
    mapa_variantes = {
        cor["nome"]: {
            v.tamanho: {"id": v.pk, "stock": v.stock}
            for v in peca.variantes_activas
            if v.cor_nome == cor["nome"]
        }
        for cor in peca.cores
    }

    url_absoluto = f"{settings.SITE_URL}{peca.get_absolute_url()}"
    imagem = peca.imagem_principal or ""

    ordenar_avaliacoes = request.GET.get("avaliacoes", "recentes")
    if ordenar_avaliacoes not in services.ORDENACOES:
        ordenar_avaliacoes = "recentes"

    contexto = {
        "produto": peca,
        "relacionados": relacionados,
        "cor_inicial": cor_inicial,
        "mapa_variantes": mapa_variantes,
        "avaliacoes": services.avaliacoes_de(peca, ordenar_avaliacoes),
        "ordenacoes_avaliacoes": services.ORDENACOES,
        "ordenar_avaliacoes": ordenar_avaliacoes,
        "pode_avaliar": services.pode_avaliar(request.user, peca),
        "motivo_sem_avaliacao": services.motivo_para_nao_avaliar(request.user, peca),
        "url_absoluto": url_absoluto,
        "dados_json": {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": f"{peca.marca.nome} {peca.nome}",
            "description": peca.descricao,
            "sku": peca.variantes_activas[0].sku if peca.variantes_activas else peca.slug,
            "image": [f"{settings.SITE_URL}{imagem}"] if imagem else [],
            # A marca é a real, não a loja: declarar CHICOPLUG como fabricante
            # seria factualmente errado e prejudica o rich snippet.
            "brand": {"@type": "Brand", "name": peca.marca.nome},
            "category": peca.categoria.nome,
            "offers": {
                "@type": "Offer",
                "url": url_absoluto,
                "priceCurrency": "AOA",
                "price": peca.preco,
                "availability": "https://schema.org/InStock"
                if peca.tem_stock
                else "https://schema.org/OutOfStock",
                "itemCondition": "https://schema.org/NewCondition",
                "seller": {"@type": "Organization", "name": "CHICOPLUG"},
            },
        },
        "migalhas_json": {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": settings.SITE_URL},
                {"@type": "ListItem", "position": 2, "name": "Shop", "item": f"{settings.SITE_URL}/shop/"},
                {
                    "@type": "ListItem",
                    "position": 3,
                    "name": peca.marca.nome,
                    "item": f"{settings.SITE_URL}/marcas/{peca.marca.slug}/",
                },
                {"@type": "ListItem", "position": 4, "name": peca.nome, "item": url_absoluto},
            ],
        },
    }

    # Só declaramos a classificação agregada quando ela existe: anunciar uma
    # média sem avaliações é enganador e os motores de busca penalizam-no.
    if peca.total_avaliacoes:
        contexto["dados_json"]["aggregateRating"] = {
            "@type": "AggregateRating",
            "ratingValue": peca.media_avaliacoes,
            "reviewCount": peca.total_avaliacoes,
            "bestRating": 5,
            "worstRating": 1,
        }

    return render(request, "catalogo/produto.html", contexto)


@login_required
@require_POST
def avaliar(request, slug):
    peca = get_object_or_404(Produto.objects.filter(activo=True), slug=slug)
    try:
        services.criar_avaliacao(
            utilizador=request.user,
            produto=peca,
            estrelas=request.POST.get("estrelas"),
            comentario=request.POST.get("comentario", ""),
            fotografias=request.FILES.getlist("fotografias"),
        )
        messages.success(request, "Obrigado — a tua avaliação já está publicada.")
    except services.ErroDeNegocio as erro:
        messages.error(request, str(erro))

    return redirect(f"{peca.get_absolute_url()}#avaliacoes")


def galeria(request):
    """Fotografias reais dos clientes, vindas das avaliações publicadas."""
    return render(request, "catalogo/galeria.html", {"fotografias": services.galeria_de_clientes()})


def marcas(request):
    return render(
        request,
        "catalogo/marcas.html",
        {"marcas": Marca.objects.activas().com_contagem()},
    )


def marca(request, slug):
    escolhida = get_object_or_404(Marca.objects.activas(), slug=slug)
    produtos = (
        Produto.objects.activos()
        .completos()
        .filter(marca=escolhida)
        .order_by("-novidade", "-criado_em")
    )

    return render(
        request,
        "catalogo/marca.html",
        {
            "marca": escolhida,
            "produtos": produtos,
            "dados_json": {
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                "name": f"{escolhida.nome} — CHICOPLUG",
                "description": escolhida.descricao,
                "url": f"{settings.SITE_URL}{escolhida.get_absolute_url()}",
                "about": {"@type": "Brand", "name": escolhida.nome},
                "mainEntity": {
                    "@type": "ItemList",
                    "numberOfItems": produtos.count(),
                    "itemListElement": [
                        {
                            "@type": "ListItem",
                            "position": i + 1,
                            "name": p.nome,
                            "url": f"{settings.SITE_URL}{p.get_absolute_url()}",
                        }
                        for i, p in enumerate(produtos[:30])
                    ],
                },
            },
        },
    )


def sugestoes(request):
    """Sugestões da barra de pesquisa — marca, produto ou categoria."""
    termo = request.GET.get("q", "").strip()
    if len(termo) < 2:
        return JsonResponse({"produtos": [], "marcas": []})

    produtos = (
        Produto.objects.activos()
        .completos()
        .filter(
            Q(nome__icontains=termo)
            | Q(marca__nome__icontains=termo)
            | Q(categoria__nome__icontains=termo)
        )[:6]
    )
    marcas_encontradas = Marca.objects.activas().filter(nome__icontains=termo)[:3]

    return JsonResponse(
        {
            "produtos": [
                {
                    "nome": p.nome,
                    "marca": p.marca.nome,
                    "preco": p.preco,
                    "url": p.get_absolute_url(),
                    "imagem": p.imagem_principal or "",
                }
                for p in produtos
            ],
            "marcas": [
                {"nome": m.nome, "url": m.get_absolute_url()} for m in marcas_encontradas
            ],
        }
    )


@require_POST
def subscrever(request):
    """
    Inscrição na newsletter.

    Idempotente e discreta: reinscrever devolve sucesso em vez de erro — quem
    escreve o email duas vezes não fez nada de errado, e um conflito revelaria
    que aquele endereço já está na lista.
    """
    email = (request.POST.get("email") or "").strip().lower()
    origem = request.POST.get("origem", "footer")

    if "@" not in email or "." not in email.split("@")[-1]:
        return JsonResponse({"ok": False, "mensagem": "Email inválido."}, status=422)

    Subscritor.objects.update_or_create(
        email=email, defaults={"activo": True, "removido_em": None, "origem": origem}
    )
    return JsonResponse(
        {"ok": True, "mensagem": "Inscrição feita. Vais saber das novidades em primeira mão."}
    )


# ─── Páginas institucionais ───────────────────────────────────────────────────


def sobre(request):
    return render(request, "catalogo/sobre.html")


def contacto(request):
    return render(request, "catalogo/contacto.html")


def faq(request):
    return render(request, "catalogo/faq.html")


def legal(request, pagina):
    """Termos, privacidade e trocas partilham a mesma moldura."""
    titulos = {
        "termos": "Termos e Condições",
        "privacidade": "Política de Privacidade",
        "trocas": "Política de Trocas",
    }
    return render(
        request,
        f"catalogo/legal_{pagina}.html",
        {"titulo_pagina": titulos.get(pagina, "")},
    )
