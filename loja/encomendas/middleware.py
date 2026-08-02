import uuid

CHAVE_SESSAO_CARRINHO = "chave_carrinho"


class CarrinhoMiddleware:
    """
    Garante que todo o visitante tem identificador de carrinho.

    O carrinho anónimo vive na sessão do Django. Criar a chave aqui — e não no
    momento de adicionar a primeira peça — evita a corrida em que dois pedidos
    simultâneos criam dois carrinhos para a mesma pessoa.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.session.get(CHAVE_SESSAO_CARRINHO):
            request.session[CHAVE_SESSAO_CARRINHO] = uuid.uuid4().hex
        return self.get_response(request)
