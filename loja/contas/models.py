from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models, transaction
from django.utils import timezone


class GestorUtilizador(BaseUserManager):
    """Cria contas identificadas por email, não por nome de utilizador."""

    use_in_migrations = True

    def _criar(self, email, password, **extra):
        if not email:
            raise ValueError("O email é obrigatório.")
        # Normalizar aqui — e não só no formulário — garante que contas criadas
        # por script, seed ou shell não escapam à regra.
        email = self.normalize_email(email).lower()
        utilizador = self.model(email=email, **extra)
        utilizador.set_password(password)
        utilizador.save(using=self._db)
        return utilizador

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._criar(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("papel", Utilizador.Papel.ADMIN)
        if extra.get("is_staff") is not True:
            raise ValueError("Um superutilizador tem de ter is_staff=True.")
        return self._criar(email, password, **extra)


class Utilizador(AbstractBaseUser, PermissionsMixin):
    """
    Cliente da loja.

    Substitui o utilizador predefinido do Django para usar o email como
    identificador: numa loja, pedir um "nome de utilizador" separado do email é
    fricção sem contrapartida.
    """

    class Papel(models.TextChoices):
        CLIENTE = "USER", "Cliente"
        ADMIN = "ADMIN", "Administrador"

    email = models.EmailField("email", unique=True, max_length=254)
    primeiro_nome = models.CharField("nome", max_length=60)
    apelido = models.CharField("apelido", max_length=60)
    telefone = models.CharField("telefone", max_length=30, blank=True)

    papel = models.CharField(max_length=10, choices=Papel.choices, default=Papel.CLIENTE)

    # Corresponde ao toggle "Notificações de novidades" na área de cliente.
    aceita_marketing = models.BooleanField("aceita comunicações", default=True)

    is_active = models.BooleanField("activa", default=True)
    # Exigido pelo PermissionsMixin do Django; o acesso ao painel é decidido
    # por `papel`, não por este campo.
    is_staff = models.BooleanField("acesso administrativo", default=False)

    criado_em = models.DateTimeField(default=timezone.now)
    actualizado_em = models.DateTimeField(auto_now=True)

    objects = GestorUtilizador()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["primeiro_nome", "apelido"]

    class Meta:
        db_table = "utilizadores"
        verbose_name = "utilizador"
        verbose_name_plural = "utilizadores"
        ordering = ["-criado_em"]
        indexes = [models.Index(fields=["papel"])]

    def __str__(self):
        return self.email

    @property
    def nome_completo(self):
        return f"{self.primeiro_nome} {self.apelido}".strip()

    @property
    def iniciais(self):
        return (f"{self.primeiro_nome[:1]}{self.apelido[:1]}").upper() or "CP"

    @property
    def e_admin(self):
        return self.papel == self.Papel.ADMIN


class Morada(models.Model):
    """Morada de entrega guardada no perfil do cliente."""

    utilizador = models.ForeignKey(Utilizador, on_delete=models.CASCADE, related_name="moradas")

    etiqueta = models.CharField("nome da morada", max_length=40)
    destinatario = models.CharField(max_length=120)
    telefone = models.CharField(max_length=30)
    provincia = models.CharField(max_length=60)
    municipio = models.CharField(max_length=60)
    rua = models.CharField(max_length=240)
    observacoes = models.TextField(blank=True)
    principal = models.BooleanField(default=False)

    criado_em = models.DateTimeField(auto_now_add=True)
    actualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "moradas"
        verbose_name_plural = "moradas"
        ordering = ["-principal", "criado_em"]

    def __str__(self):
        return f"{self.etiqueta} — {self.municipio}"

    def tornar_principal(self):
        """
        Promove esta morada, despromovendo as outras na mesma operação.

        Duas escritas dentro da mesma transacção: se ficassem duas moradas
        "principais", o checkout não saberia qual escolher.
        """
        with transaction.atomic():
            Morada.objects.filter(utilizador=self.utilizador).exclude(pk=self.pk).update(
                principal=False
            )
            Morada.objects.filter(pk=self.pk).update(principal=True)
