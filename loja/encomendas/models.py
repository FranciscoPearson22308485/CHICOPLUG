from django.conf import settings
from django.db import models
from django.urls import reverse
from django.utils import timezone

from catalogo.models import Variante


# ─── Carrinho ─────────────────────────────────────────────────────────────────


class Carrinho(models.Model):
    """
    Carrinho persistente.

    Pertence a um utilizador autenticado OU a uma sessão anónima. Obrigar a
    criar conta antes de juntar peças é uma das maiores causas de abandono, por
    isso o carrinho anónimo existe e é fundido no do utilizador ao entrar.
    """

    utilizador = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="carrinho",
        null=True,
        blank=True,
    )
    chave_sessao = models.CharField(max_length=64, unique=True, null=True, blank=True)

    criado_em = models.DateTimeField(auto_now_add=True)
    actualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "carrinhos"

    def __str__(self):
        return f"Carrinho de {self.utilizador or self.chave_sessao}"

    @property
    def linhas(self):
        return self.itens.select_related(
            "variante__produto__marca", "variante__produto__categoria"
        ).prefetch_related("variante__produto__imagens")

    @property
    def total_pecas(self):
        return sum(item.quantidade for item in self.itens.all())

    @property
    def subtotal(self):
        return sum(item.total_linha for item in self.linhas)

    @property
    def envio(self):
        return calcular_envio(self.subtotal)

    @property
    def total(self):
        return self.subtotal + self.envio

    @property
    def falta_para_envio_gratis(self):
        return max(0, settings.ENVIO_GRATIS_A_PARTIR_DE - self.subtotal)

    def problemas_de_stock(self):
        """
        Linhas cuja quantidade já não cabe no stock.

        Entre adicionar ao carrinho e pagar podem passar dias; revalidar à
        entrada do checkout evita falhar só na transacção final.
        """
        return [item for item in self.linhas if item.quantidade > item.variante.stock]


def calcular_envio(subtotal: int) -> int:
    if subtotal == 0:
        return 0
    return 0 if subtotal >= settings.ENVIO_GRATIS_A_PARTIR_DE else settings.CUSTO_ENVIO


class ItemCarrinho(models.Model):
    carrinho = models.ForeignKey(Carrinho, on_delete=models.CASCADE, related_name="itens")
    variante = models.ForeignKey(Variante, on_delete=models.CASCADE, related_name="itens_carrinho")
    quantidade = models.PositiveIntegerField(default=1)

    criado_em = models.DateTimeField(auto_now_add=True)
    actualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "itens_carrinho"
        ordering = ["criado_em"]
        constraints = [
            models.UniqueConstraint(fields=["carrinho", "variante"], name="item_unico_no_carrinho")
        ]

    def __str__(self):
        return f"{self.quantidade}× {self.variante}"

    @property
    def preco_unitario(self):
        return self.variante.preco

    @property
    def total_linha(self):
        return self.preco_unitario * self.quantidade

    @property
    def excede_stock(self):
        return self.quantidade > self.variante.stock


# ─── Cupões ───────────────────────────────────────────────────────────────────


class Cupao(models.Model):
    class Tipo(models.TextChoices):
        PERCENTAGEM = "PERCENT", "Percentagem"
        VALOR_FIXO = "FIXED", "Valor fixo"

    codigo = models.CharField(max_length=40, unique=True)
    tipo = models.CharField(max_length=10, choices=Tipo.choices, default=Tipo.PERCENTAGEM)
    # Percentagem (1–100) ou Kwanzas, conforme o tipo.
    valor = models.PositiveIntegerField()

    subtotal_minimo = models.PositiveIntegerField(null=True, blank=True)
    max_utilizacoes = models.PositiveIntegerField(null=True, blank=True)
    vezes_usado = models.PositiveIntegerField(default=0)

    comeca_em = models.DateTimeField(null=True, blank=True)
    termina_em = models.DateTimeField(null=True, blank=True)
    activo = models.BooleanField(default=True)

    criado_em = models.DateTimeField(auto_now_add=True)
    actualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cupoes"
        verbose_name_plural = "cupões"
        ordering = ["-criado_em"]

    def __str__(self):
        return self.codigo

    def save(self, *args, **kwargs):
        self.codigo = self.codigo.strip().upper()
        super().save(*args, **kwargs)

    def desconto_para(self, subtotal: int) -> int:
        """
        Arredonda para baixo: com percentagens sobre Kwanzas inteiros,
        arredondar para cima faria o total não bater com a soma das linhas.
        """
        if self.tipo == self.Tipo.PERCENTAGEM:
            bruto = subtotal * self.valor / 100
        else:
            bruto = self.valor
        # Nunca desconta mais do que o subtotal — um total negativo é absurdo.
        return min(subtotal, int(bruto))

    def erro_para(self, subtotal: int):
        """Devolve a razão pela qual o cupão não se aplica, ou None."""
        agora = timezone.now()
        if not self.activo:
            return "Cupão inválido."
        if self.comeca_em and self.comeca_em > agora:
            return "Este cupão ainda não começou."
        if self.termina_em and self.termina_em < agora:
            return "Este cupão expirou."
        if self.max_utilizacoes is not None and self.vezes_usado >= self.max_utilizacoes:
            return "Este cupão atingiu o limite de utilizações."
        if self.subtotal_minimo and subtotal < self.subtotal_minimo:
            return f"Este cupão exige um subtotal mínimo de {self.subtotal_minimo} Kz."
        return None

    @property
    def estado_efectivo(self):
        """
        Um cupão "activo" mas expirado não funciona — a interface deve dizê-lo
        em vez de mostrar um visto verde enganador.
        """
        agora = timezone.now()
        if not self.activo:
            return "INACTIVO"
        if self.comeca_em and self.comeca_em > agora:
            return "AGENDADO"
        if self.termina_em and self.termina_em < agora:
            return "EXPIRADO"
        if self.max_utilizacoes is not None and self.vezes_usado >= self.max_utilizacoes:
            return "ESGOTADO"
        return "ACTIVO"


# ─── Encomendas ───────────────────────────────────────────────────────────────


class EstadoEncomenda(models.TextChoices):
    NOVA = "NOVA", "Nova"
    CONFIRMADA = "CONFIRMADA", "Confirmada"
    EM_PREPARACAO = "EM_PREPARACAO", "Em preparação"
    ENVIADA = "ENVIADA", "Enviada"
    ENTREGUE = "ENTREGUE", "Entregue"
    CANCELADA = "CANCELADA", "Cancelada"


# Grafo explícito de transições, e não uma lista ordenada: o fluxo real não é
# linear — uma encomenda pode ser cancelada em quase qualquer ponto, mas nunca
# depois de entregue (uma devolução é outro processo, não um retrocesso).
TRANSICOES = {
    EstadoEncomenda.NOVA: [EstadoEncomenda.CONFIRMADA, EstadoEncomenda.CANCELADA],
    EstadoEncomenda.CONFIRMADA: [EstadoEncomenda.EM_PREPARACAO, EstadoEncomenda.CANCELADA],
    EstadoEncomenda.EM_PREPARACAO: [EstadoEncomenda.ENVIADA, EstadoEncomenda.CANCELADA],
    EstadoEncomenda.ENVIADA: [EstadoEncomenda.ENTREGUE, EstadoEncomenda.CANCELADA],
    EstadoEncomenda.ENTREGUE: [],
    EstadoEncomenda.CANCELADA: [],
}

# Percurso normal de uma encomenda, usado para desenhar a linha do tempo com
# os passos que ainda faltam — sem eles, o cliente vê só o que já aconteceu e
# não sabe quantas etapas ainda existem.
PERCURSO_NORMAL = [
    EstadoEncomenda.NOVA,
    EstadoEncomenda.CONFIRMADA,
    EstadoEncomenda.EM_PREPARACAO,
    EstadoEncomenda.ENVIADA,
    EstadoEncomenda.ENTREGUE,
]

# Estados em que o stock ainda está reservado e deve voltar ao inventário.
REPOR_STOCK_AO_CANCELAR = {
    EstadoEncomenda.NOVA,
    EstadoEncomenda.CONFIRMADA,
    EstadoEncomenda.EM_PREPARACAO,
    EstadoEncomenda.ENVIADA,
}

TOM_ESTADO = {
    EstadoEncomenda.NOVA: "muted",
    EstadoEncomenda.CONFIRMADA: "brand",
    EstadoEncomenda.EM_PREPARACAO: "brand",
    EstadoEncomenda.ENVIADA: "dark",
    EstadoEncomenda.ENTREGUE: "dark",
    EstadoEncomenda.CANCELADA: "muted",
}


def pode_transitar(de: str, para: str) -> bool:
    return para in TRANSICOES.get(de, [])


def deve_repor_stock(de: str, para: str) -> bool:
    return para == EstadoEncomenda.CANCELADA and de in REPOR_STOCK_AO_CANCELAR


class Encomenda(models.Model):
    # Referência legível apresentada ao cliente, ex.: "CP-2044".
    referencia = models.CharField(max_length=20, unique=True)

    utilizador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="encomendas",
        null=True,
        blank=True,
    )

    # Dados de contacto copiados no momento da compra — sobrevivem à remoção
    # da conta e a alterações de perfil.
    nome_cliente = models.CharField(max_length=120)
    email = models.EmailField(max_length=254)
    telefone = models.CharField(max_length=30)

    estado = models.CharField(
        max_length=20, choices=EstadoEncomenda.choices, default=EstadoEncomenda.NOVA
    )

    subtotal = models.PositiveIntegerField()
    envio = models.PositiveIntegerField(default=0)
    desconto = models.PositiveIntegerField(default=0)
    total = models.PositiveIntegerField()

    provincia = models.CharField(max_length=60)
    municipio = models.CharField(max_length=60)
    rua = models.CharField(max_length=240)
    observacoes = models.TextField(blank=True)

    cupao = models.ForeignKey(
        Cupao, on_delete=models.SET_NULL, related_name="encomendas", null=True, blank=True
    )

    # Evita repor o stock duas vezes em cancelamentos concorrentes.
    stock_reposto = models.BooleanField(default=False)

    criado_em = models.DateTimeField(auto_now_add=True)
    actualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "encomendas"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["estado"]),
            models.Index(fields=["-criado_em"]),
        ]

    def __str__(self):
        return self.referencia

    def get_absolute_url(self):
        return reverse("encomendas:detalhe", args=[self.referencia])

    @property
    def total_pecas(self):
        return sum(item.quantidade for item in self.itens.all())

    @property
    def tom_estado(self):
        return TOM_ESTADO.get(self.estado, "muted")

    @property
    def transicoes_possiveis(self):
        return [
            {"valor": e, "rotulo": EstadoEncomenda(e).label} for e in TRANSICOES.get(self.estado, [])
        ]

    @property
    def cancelavel_pelo_cliente(self):
        # Depois de entrar em preparação, o cancelamento passa a ser tratado
        # por atendimento — a peça pode já estar embalada.
        return self.estado in {EstadoEncomenda.NOVA, EstadoEncomenda.CONFIRMADA}

    @property
    def pagamento_actual(self):
        return self.pagamentos.order_by("-criado_em").first()

    # ── Acompanhamento ───────────────────────────────────────────────────────

    @property
    def linha_do_tempo(self):
        """
        Percurso da encomenda, com o que já aconteceu e o que ainda falta.

        Mostrar só os eventos passados deixaria o cliente sem saber quantas
        etapas restam. Os passos futuros aparecem por cumprir, com a data em
        branco — nunca com uma data inventada.
        """
        eventos = {ev.estado_novo: ev for ev in self.eventos.all()}
        cancelada = self.estado == EstadoEncomenda.CANCELADA

        # Numa encomenda cancelada, o percurso pára onde parou e o último passo
        # passa a ser o cancelamento.
        if cancelada:
            percorridos = [e for e in PERCURSO_NORMAL if e in eventos]
            passos = percorridos + [EstadoEncomenda.CANCELADA]
        else:
            passos = PERCURSO_NORMAL

        linha = []
        for estado in passos:
            evento = eventos.get(estado)
            linha.append({
                "estado": estado,
                "rotulo": EstadoEncomenda(estado).label,
                "evento": evento,
                "quando": evento.criado_em if evento else None,
                "nota": evento.nota if evento else "",
                "concluido": evento is not None,
                "actual": estado == self.estado,
            })
        return linha

    @property
    def previsao_entrega(self):
        """Janela de entrega estimada, ou None quando já não se aplica."""
        from .services import previsao_de_entrega

        if self.estado in (EstadoEncomenda.ENTREGUE, EstadoEncomenda.CANCELADA):
            return None
        return previsao_de_entrega(self.provincia, desde=self.criado_em)


class ItemEncomenda(models.Model):
    """
    Instantâneo do produto no momento da compra.

    Nome, preço e imagem ficam desnormalizados de propósito: ligá-los ao
    catálogo por chave estrangeira faria o histórico reescrever-se sozinho
    sempre que uma peça fosse editada.
    """

    encomenda = models.ForeignKey(Encomenda, on_delete=models.CASCADE, related_name="itens")
    variante = models.ForeignKey(
        Variante, on_delete=models.SET_NULL, related_name="itens_encomenda", null=True, blank=True
    )

    marca = models.CharField(max_length=120)
    nome_produto = models.CharField(max_length=140)
    slug_produto = models.SlugField(max_length=180)
    url_imagem = models.CharField(max_length=500, blank=True)
    tamanho = models.CharField(max_length=20)
    cor_nome = models.CharField(max_length=40)
    sku = models.CharField(max_length=64, blank=True)

    preco_unitario = models.PositiveIntegerField()
    quantidade = models.PositiveIntegerField()
    total_linha = models.PositiveIntegerField()

    class Meta:
        db_table = "itens_encomenda"
        ordering = ["id"]

    def __str__(self):
        return f"{self.quantidade}× {self.marca} {self.nome_produto}"


class EventoEncomenda(models.Model):
    """Trilho de auditoria das transições de estado."""

    encomenda = models.ForeignKey(Encomenda, on_delete=models.CASCADE, related_name="eventos")
    estado_anterior = models.CharField(max_length=20, choices=EstadoEncomenda.choices, blank=True)
    estado_novo = models.CharField(max_length=20, choices=EstadoEncomenda.choices)
    nota = models.CharField(max_length=500, blank=True)
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "eventos_encomenda"
        ordering = ["criado_em"]

    def __str__(self):
        return f"{self.encomenda.referencia}: {self.estado_novo}"


# ─── Pagamentos ───────────────────────────────────────────────────────────────


class EstadoPagamento(models.TextChoices):
    PENDENTE = "PENDENTE", "Pendente"
    PAGO = "PAGO", "Pago"
    CANCELADO = "CANCELADO", "Cancelado"
    FALHADO = "FALHADO", "Falhado"


class Pagamento(models.Model):
    encomenda = models.ForeignKey(Encomenda, on_delete=models.CASCADE, related_name="pagamentos")

    provedor = models.CharField(max_length=30)
    estado = models.CharField(
        max_length=20, choices=EstadoPagamento.choices, default=EstadoPagamento.PENDENTE
    )

    montante = models.PositiveIntegerField()
    moeda = models.CharField(max_length=3, default="AOA")

    # Referência que enviamos ao provedor (idempotente por tentativa).
    referencia = models.CharField(max_length=80, unique=True)
    # Identificador devolvido pelo provedor (token EMIS, id de transacção).
    referencia_provedor = models.CharField(max_length=120, blank=True)

    # Última resposta bruta — indispensável para reconciliação.
    resposta_bruta = models.JSONField(null=True, blank=True)

    motivo_falha = models.CharField(max_length=300, blank=True)
    pago_em = models.DateTimeField(null=True, blank=True)
    expira_em = models.DateTimeField(null=True, blank=True)

    criado_em = models.DateTimeField(auto_now_add=True)
    actualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "pagamentos"
        ordering = ["-criado_em"]
        indexes = [models.Index(fields=["estado"])]

    def __str__(self):
        return f"{self.referencia} ({self.estado})"

    @property
    def expirado(self):
        return bool(self.expira_em and self.expira_em < timezone.now())
