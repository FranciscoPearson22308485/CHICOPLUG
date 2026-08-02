from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend

Utilizador = get_user_model()


class EmailBackend(ModelBackend):
    """
    Autenticação por email, sem distinguir maiúsculas.

    Quando o email não existe, corremos na mesma o hash da password: sem isso,
    um pedido com email inexistente responde muito mais depressa do que um com
    password errada — e essa diferença de tempo permite descobrir que contas
    estão registadas.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        email = (username or kwargs.get("email") or "").strip().lower()
        if not email or not password:
            return None

        try:
            utilizador = Utilizador.objects.get(email__iexact=email)
        except Utilizador.DoesNotExist:
            Utilizador().set_password(password)
            return None

        if utilizador.check_password(password) and self.user_can_authenticate(utilizador):
            return utilizador
        return None
