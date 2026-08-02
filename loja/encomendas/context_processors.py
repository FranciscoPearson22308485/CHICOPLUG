from .services import obter_carrinho


def carrinho(request):
    """Carrinho actual, para o contador da navbar estar sempre correcto."""
    actual = obter_carrinho(request, criar=False)
    return {
        "carrinho": actual,
        "carrinho_total_pecas": actual.total_pecas if actual else 0,
    }
