from django.core.cache import cache

from .models import Categoria, Marca


def navegacao(request):
    """
    Marcas e categorias para a navbar e o rodapé.

    Presente em todas as páginas, por isso vai a cache: o catálogo muda quando o
    administrador o edita, não a cada visita.
    """
    dados = cache.get("navegacao")
    if dados is None:
        dados = {
            "nav_marcas": list(Marca.objects.activas().com_contagem()[:12]),
            "nav_categorias": list(Categoria.objects.activas().com_contagem()),
        }
        cache.set("navegacao", dados, 300)
    return dados
