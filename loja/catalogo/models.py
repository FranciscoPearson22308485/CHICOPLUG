from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q, Sum
from django.urls import reverse
from django.utils.functional import cached_property
from django.utils.text import slugify


class MarcaQuerySet(models.QuerySet):
    def activas(self):
        return self.filter(activa=True)

    def em_destaque(self):
        return self.activas().filter(destaque=True)

    def com_contagem(self):
        """Anota o número de peças publicadas — evita uma consulta por marca."""
        return self.annotate(
            total_produtos=models.Count("produtos", filter=Q(produtos__activo=True))
        )


class Marca(models.Model):
    """
    Marca vendida na loja (Nike, Corteiz, Represent…).

    A CHICOPLUG é uma boutique multimarca: não fabrica roupa, cura e revende.
    """

    slug = models.SlugField(max_length=140, unique=True, blank=True)
    nome = models.CharField(max_length=120, unique=True)
    # Frase de posicionamento apresentada sob o nome ("Sportswear icónico desde 1964").
    assinatura = models.CharField("posicionamento", max_length=160, blank=True)
    descricao = models.TextField(blank=True)

    imagem = models.ImageField("imagem editorial", upload_to="marcas/", blank=True, null=True)
    logotipo = models.ImageField(upload_to="marcas/logos/", blank=True, null=True)

    # Marca a presença na secção "Marcas Populares" da homepage.
    destaque = models.BooleanField(default=False)
    posicao = models.PositiveIntegerField(default=0)
    activa = models.BooleanField(default=True)

    criado_em = models.DateTimeField(auto_now_add=True)
    actualizado_em = models.DateTimeField(auto_now=True)

    objects = MarcaQuerySet.as_manager()

    class Meta:
        db_table = "marcas"
        ordering = ["posicao", "nome"]
        indexes = [
            models.Index(fields=["activa", "posicao"]),
            models.Index(fields=["destaque"]),
        ]

    def __str__(self):
        return self.nome

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.nome)
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse("catalogo:marca", args=[self.slug])

    @property
    def total_pecas(self):
        # Usa a anotação quando existe, para não disparar uma consulta extra.
        if hasattr(self, "total_produtos"):
            return self.total_produtos
        return self.produtos.filter(activo=True).count()


class CategoriaQuerySet(models.QuerySet):
    def activas(self):
        return self.filter(activa=True)

    def com_contagem(self):
        return self.annotate(
            total_produtos=models.Count("produtos", filter=Q(produtos__activo=True))
        )


class Categoria(models.Model):
    """Tipo de peça: T-Shirts, Hoodies, Jeans, Sneakers…"""

    slug = models.SlugField(max_length=140, unique=True, blank=True)
    nome = models.CharField(max_length=80, unique=True)
    descricao = models.TextField(blank=True)
    posicao = models.PositiveIntegerField(default=0)
    activa = models.BooleanField(default=True)

    criado_em = models.DateTimeField(auto_now_add=True)
    actualizado_em = models.DateTimeField(auto_now=True)

    objects = CategoriaQuerySet.as_manager()

    class Meta:
        db_table = "categorias"
        verbose_name_plural = "categorias"
        ordering = ["posicao", "nome"]
        indexes = [models.Index(fields=["activa", "posicao"])]

    def __str__(self):
        return self.nome

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.nome)
        super().save(*args, **kwargs)

    @property
    def total_pecas(self):
        if hasattr(self, "total_produtos"):
            return self.total_produtos
        return self.produtos.filter(activo=True).count()

    @property
    def imagem_representativa(self):
        """Primeira imagem de uma peça da categoria, para o card da homepage."""
        produto = self.produtos.filter(activo=True).order_by("-criado_em").first()
        if not produto:
            return None
        imagem = produto.imagens.first()
        return imagem.url_imagem if imagem else None


class ProdutoQuerySet(models.QuerySet):
    def activos(self):
        return self.filter(activo=True)

    def completos(self):
        """
        Pré-carrega tudo o que um card de produto precisa.

        Sem isto, listar 24 peças dispara centenas de consultas — uma por marca,
        categoria, imagem e variante de cada peça.
        """
        return self.select_related("marca", "categoria").prefetch_related("imagens", "variantes")

    def em_promocao(self):
        return self.activos().filter(preco_anterior__isnull=False)

    def com_stock(self):
        return self.activos().filter(variantes__stock__gt=0, variantes__activa=True).distinct()


class Produto(models.Model):
    """Peça do catálogo. O stock real vive nas variantes."""

    class Distintivo(models.TextChoices):
        NOVO = "NOVO", "Novo"
        ULTIMAS_UNIDADES = "ULTIMAS_UNIDADES", "Últimas unidades"

    slug = models.SlugField(max_length=180, unique=True, blank=True)
    # O nome NÃO repete a marca: a interface mostra os dois campos lado a lado.
    nome = models.CharField(max_length=140)
    descricao = models.TextField()
    # Um detalhe por linha, apresentado no acordeão "Detalhes".
    detalhes = models.TextField(blank=True, help_text="Um detalhe por linha.")

    preco = models.PositiveIntegerField("preço (Kz)")
    preco_anterior = models.PositiveIntegerField("preço anterior (Kz)", null=True, blank=True)

    marca = models.ForeignKey(Marca, on_delete=models.PROTECT, related_name="produtos")
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT, related_name="produtos")

    distintivo = models.CharField(max_length=20, choices=Distintivo.choices, blank=True)
    novidade = models.BooleanField(default=False)
    mais_vendido = models.BooleanField(default=False)
    activo = models.BooleanField(default=True)

    meta_titulo = models.CharField(max_length=160, blank=True)
    meta_descricao = models.CharField(max_length=320, blank=True)

    criado_em = models.DateTimeField(auto_now_add=True)
    actualizado_em = models.DateTimeField(auto_now=True)

    objects = ProdutoQuerySet.as_manager()

    class Meta:
        db_table = "produtos"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["activo", "-criado_em"]),
            models.Index(fields=["marca"]),
            models.Index(fields=["categoria"]),
            models.Index(fields=["preco"]),
        ]

    def __str__(self):
        return f"{self.marca.nome} {self.nome}"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(f"{self.marca.nome} {self.nome}")[:180]

        # Lê o preço em vigor antes de o substituir. Uma consulta por gravação
        # de produto é barata — só acontece no painel — e é o que permite ter
        # um histórico fiável sem depender de quem edita se lembrar de o criar.
        preco_em_vigor = None
        if self.pk:
            preco_em_vigor = (
                Produto.objects.filter(pk=self.pk).values_list("preco", flat=True).first()
            )

        super().save(*args, **kwargs)

        if preco_em_vigor is not None and preco_em_vigor != self.preco:
            HistoricoPreco.objects.create(
                produto=self, preco_anterior=preco_em_vigor, preco_novo=self.preco
            )

    def get_absolute_url(self):
        return reverse("catalogo:produto", args=[self.slug])

    # ── Stock e disponibilidade ──────────────────────────────────────────────

    @property
    def variantes_activas(self):
        return [v for v in self.variantes.all() if v.activa]

    @property
    def stock(self):
        """Soma das variantes activas — a fonte de verdade é cada variante."""
        return sum(v.stock for v in self.variantes_activas)

    @property
    def tem_stock(self):
        return self.stock > 0

    @property
    def tamanhos(self):
        """Preserva a ordem de criação (S → XXL), não a alfabética."""
        vistos = []
        for v in self.variantes_activas:
            if v.tamanho not in vistos:
                vistos.append(v.tamanho)
        return vistos

    @property
    def cores(self):
        vistas, resultado = set(), []
        for v in self.variantes_activas:
            if v.cor_nome not in vistas:
                vistas.add(v.cor_nome)
                resultado.append({"nome": v.cor_nome, "hex": v.cor_hex})
        return resultado

    # ── Avaliações ───────────────────────────────────────────────────────────

    @cached_property
    def _contagem_por_estrelas(self):
        """
        {5: 12, 4: 3, …} numa só consulta.

        `cached_property` porque a ficha de produto pede a média, o total e a
        distribuição — sem isto seriam três varrimentos da mesma tabela.
        """
        linhas = (
            self.avaliacoes.publicadas()
            .values("estrelas")
            .annotate(total=models.Count("id"))
        )
        return {linha["estrelas"]: linha["total"] for linha in linhas}

    @property
    def total_avaliacoes(self):
        return sum(self._contagem_por_estrelas.values())

    @property
    def media_avaliacoes(self):
        """None quando ainda não há avaliações — 0,0 leria como péssima."""
        total = self.total_avaliacoes
        if not total:
            return None
        soma = sum(estrelas * n for estrelas, n in self._contagem_por_estrelas.items())
        return round(soma / total, 1)

    @property
    def distribuicao_avaliacoes(self):
        """De 5 a 1 estrelas, com percentagem — alimenta as barras do resumo."""
        total = self.total_avaliacoes
        return [
            {
                "estrelas": n,
                "total": self._contagem_por_estrelas.get(n, 0),
                "percentagem": round(self._contagem_por_estrelas.get(n, 0) / total * 100) if total else 0,
            }
            for n in range(5, 0, -1)
        ]

    @property
    def media_em_estrelas(self):
        """[(1, cheia?), …] para desenhar a média sem lógica no template."""
        media = self.media_avaliacoes or 0
        return [(n, n <= round(media)) for n in range(1, 6)]

    # ── Apresentação ─────────────────────────────────────────────────────────

    @property
    def lista_detalhes(self):
        return [linha.strip() for linha in self.detalhes.splitlines() if linha.strip()]

    @property
    def imagem_principal(self):
        primeira = self.imagens.first()
        return primeira.url_imagem if primeira else None

    @property
    def imagem_secundaria(self):
        """Segunda imagem — usada no efeito de troca ao passar o rato no card."""
        imagens = list(self.imagens.all())
        return imagens[1].url_imagem if len(imagens) > 1 else None

    @property
    def percentagem_desconto(self):
        if not self.preco_anterior or self.preco_anterior <= self.preco:
            return None
        return round((self.preco_anterior - self.preco) / self.preco_anterior * 100)

    @property
    def valor_poupado(self):
        """Quanto o cliente poupa em Kwanzas — mais concreto do que a percentagem."""
        if not self.preco_anterior or self.preco_anterior <= self.preco:
            return None
        return self.preco_anterior - self.preco

    @property
    def ultima_alteracao_de_preco(self):
        return self.historico_precos.first()

    @property
    def etiqueta(self):
        """
        Distintivo apresentado no card.

        Sem stock, "ESGOTADO" sobrepõe-se sempre ao que estiver configurado —
        anunciar "NOVO" numa peça indisponível seria enganador.
        """
        if not self.tem_stock:
            return "ESGOTADO"
        if self.distintivo == self.Distintivo.ULTIMAS_UNIDADES:
            return "ÚLTIMAS UNIDADES"
        if self.distintivo == self.Distintivo.NOVO:
            return "NOVO"
        return None

    def variante(self, tamanho, cor_nome):
        for v in self.variantes_activas:
            if v.tamanho == tamanho and v.cor_nome == cor_nome:
                return v
        return None

    def tamanhos_disponiveis_para(self, cor_nome):
        """Tamanhos com stock na cor escolhida — permite desactivar os esgotados."""
        return {v.tamanho for v in self.variantes_activas if v.cor_nome == cor_nome and v.stock > 0}


class ImagemProduto(models.Model):
    produto = models.ForeignKey(Produto, on_delete=models.CASCADE, related_name="imagens")
    ficheiro = models.ImageField(upload_to="produtos/", blank=True, null=True)
    # Preenchido quando a imagem está no Cloudinary em vez do disco local.
    url_externa = models.URLField(max_length=500, blank=True)
    texto_alternativo = models.CharField(max_length=200, blank=True)
    posicao = models.PositiveIntegerField(default=0)

    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "imagens_produto"
        ordering = ["posicao", "id"]
        verbose_name_plural = "imagens de produto"

    def __str__(self):
        return f"{self.produto.nome} #{self.posicao}"

    @property
    def url_imagem(self):
        if self.url_externa:
            return self.url_externa
        return self.ficheiro.url if self.ficheiro else ""


class Variante(models.Model):
    """
    Combinação tamanho × cor.

    É aqui que vive o stock: o número que a interface mostra na peça é a soma
    das variantes. Guardar um único stock por produto tornaria impossível saber
    que há L em preto mas não em cinzento.
    """

    produto = models.ForeignKey(Produto, on_delete=models.CASCADE, related_name="variantes")

    tamanho = models.CharField(max_length=20)
    cor_nome = models.CharField(max_length=40)
    cor_hex = models.CharField(max_length=7, default="#111111")

    sku = models.CharField(max_length=64, unique=True)
    stock = models.PositiveIntegerField(default=0)
    # Abaixo deste valor a variante entra nos alertas de stock baixo.
    limiar_stock_baixo = models.PositiveIntegerField(default=6)
    preco_proprio = models.PositiveIntegerField(null=True, blank=True)
    activa = models.BooleanField(default=True)

    criado_em = models.DateTimeField(auto_now_add=True)
    actualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "variantes"
        ordering = ["criado_em"]
        constraints = [
            models.UniqueConstraint(
                fields=["produto", "tamanho", "cor_nome"], name="variante_unica_por_produto"
            )
        ]
        indexes = [models.Index(fields=["stock"])]

    def __str__(self):
        return f"{self.produto.nome} · {self.tamanho} / {self.cor_nome}"

    @property
    def preco(self):
        return self.preco_proprio or self.produto.preco

    @property
    def stock_baixo(self):
        return 0 < self.stock <= self.limiar_stock_baixo

    @property
    def estado_stock(self):
        if self.stock == 0:
            return "SEM_STOCK"
        return "CRITICO" if self.stock <= self.limiar_stock_baixo else "OK"


class HistoricoPreco(models.Model):
    """
    Registo de cada alteração de preço de uma peça.

    Escrito automaticamente por `Produto.save()`. Serve dois fins: mostrar ao
    cliente quanto poupa face ao preço praticado antes, e dar ao painel a
    prova de que o desconto anunciado é real — sem isto, "−30%" seria apenas
    um número escrito à mão no campo `preco_anterior`.
    """

    produto = models.ForeignKey(Produto, on_delete=models.CASCADE, related_name="historico_precos")
    preco_anterior = models.PositiveIntegerField("preço anterior (Kz)")
    preco_novo = models.PositiveIntegerField("preço novo (Kz)")
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "historico_precos"
        verbose_name_plural = "histórico de preços"
        ordering = ["-criado_em"]
        indexes = [models.Index(fields=["produto", "-criado_em"])]

    def __str__(self):
        return f"{self.produto.nome}: {self.preco_anterior} → {self.preco_novo}"

    @property
    def desceu(self):
        return self.preco_novo < self.preco_anterior

    @property
    def variacao(self):
        """Diferença absoluta em Kwanzas."""
        return abs(self.preco_novo - self.preco_anterior)

    @property
    def percentagem(self):
        if not self.preco_anterior:
            return 0
        return round(abs(self.preco_novo - self.preco_anterior) / self.preco_anterior * 100)


class AlertaReposicao(models.Model):
    """
    Inscrição para ser avisado quando uma peça esgotada voltar ao stock.

    É a lista de espera e o alerta de reposição ao mesmo tempo: quem se
    inscreve fica registado até ser avisado. Sem isto, cada esgotamento é uma
    venda perdida sem rasto — não se sabe sequer quanta procura ficou por
    servir, que é a informação que diz o que vale a pena repor.
    """

    produto = models.ForeignKey(Produto, on_delete=models.CASCADE, related_name="alertas_reposicao")
    # Opcional: quem quer especificamente um tamanho ou cor pode dizê-lo.
    variante = models.ForeignKey(
        "Variante", on_delete=models.SET_NULL, related_name="alertas", null=True, blank=True
    )

    nome = models.CharField(max_length=120)
    email = models.EmailField(max_length=254)
    telefone = models.CharField(max_length=30, blank=True)

    criado_em = models.DateTimeField(auto_now_add=True)
    notificado_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "alertas_reposicao"
        verbose_name_plural = "alertas de reposição"
        ordering = ["-criado_em"]
        indexes = [
            # A consulta feita a cada reposição de stock.
            models.Index(fields=["produto", "notificado_em"]),
        ]

    def __str__(self):
        return f"{self.email} → {self.produto.nome}"

    @property
    def pendente(self):
        return self.notificado_em is None


class AvaliacaoQuerySet(models.QuerySet):
    def publicadas(self):
        return self.filter(publicada=True)

    def completas(self):
        """Pré-carrega autor e fotografias — sem isto, listar 20 avaliações
        dispara uma consulta por autor e outra por fotografia."""
        return self.select_related("utilizador").prefetch_related("fotografias")

    def com_fotografias(self):
        return self.filter(fotografias__isnull=False).distinct()


class Avaliacao(models.Model):
    """
    Avaliação de uma peça por quem a comprou.

    Só quem comprou pode avaliar: a verificação é feita em
    `catalogo.services.pode_avaliar`, contra o histórico de encomendas. É essa
    regra que dá valor à etiqueta "Compra verificada" — sem ela, a média seria
    apenas opinião de quem passou pela página.
    """

    produto = models.ForeignKey(Produto, on_delete=models.CASCADE, related_name="avaliacoes")
    utilizador = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="avaliacoes"
    )

    estrelas = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comentario = models.TextField(blank=True)

    # Guardado em vez de deduzido: se um dia o painel permitir publicar uma
    # avaliação recolhida por outra via, a etiqueta continua a dizer a verdade.
    compra_verificada = models.BooleanField(default=True)
    # Moderação: uma avaliação despublicada deixa de contar para a média.
    publicada = models.BooleanField(default=True)

    criado_em = models.DateTimeField(auto_now_add=True)
    actualizado_em = models.DateTimeField(auto_now=True)

    objects = AvaliacaoQuerySet.as_manager()

    class Meta:
        db_table = "avaliacoes"
        verbose_name_plural = "avaliações"
        ordering = ["-criado_em"]
        constraints = [
            # Uma opinião por cliente e por peça: sem isto, um cliente podia
            # inflacionar a média de uma peça sozinho.
            models.UniqueConstraint(
                fields=["produto", "utilizador"], name="avaliacao_unica_por_cliente"
            )
        ]
        indexes = [
            models.Index(fields=["produto", "publicada"]),
            models.Index(fields=["-criado_em"]),
        ]

    def __str__(self):
        return f"{self.produto.nome} — {self.estrelas}★ por {self.utilizador.email}"

    @property
    def autor(self):
        """Primeiro nome e inicial do apelido: identifica sem expor o nome todo."""
        inicial = f" {self.utilizador.apelido[0]}." if self.utilizador.apelido else ""
        return f"{self.utilizador.primeiro_nome}{inicial}"

    @property
    def intervalo_estrelas(self):
        """[(1, cheia?), …] — o template não sabe contar sozinho."""
        return [(n, n <= self.estrelas) for n in range(1, 6)]


class FotoAvaliacao(models.Model):
    """Fotografia enviada com uma avaliação. Mesma forma que `ImagemProduto`."""

    avaliacao = models.ForeignKey(
        Avaliacao, on_delete=models.CASCADE, related_name="fotografias"
    )
    ficheiro = models.ImageField(upload_to="avaliacoes/", blank=True, null=True)
    url_externa = models.URLField(max_length=500, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "fotos_avaliacao"
        ordering = ["id"]
        verbose_name_plural = "fotografias de avaliação"

    def __str__(self):
        return f"Foto de {self.avaliacao_id}"

    @property
    def url_imagem(self):
        if self.url_externa:
            return self.url_externa
        return self.ficheiro.url if self.ficheiro else ""


class Favorito(models.Model):
    utilizador = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favoritos"
    )
    produto = models.ForeignKey(Produto, on_delete=models.CASCADE, related_name="favoritado_por")
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "favoritos"
        ordering = ["-criado_em"]
        constraints = [
            models.UniqueConstraint(fields=["utilizador", "produto"], name="favorito_unico")
        ]


class Subscritor(models.Model):
    """Inscrição na newsletter, recolhida no rodapé e na homepage."""

    email = models.EmailField(unique=True, max_length=254)
    # Onde a inscrição foi feita — útil para medir a conversão de cada ponto.
    origem = models.CharField(max_length=20, blank=True)
    activo = models.BooleanField(default=True)

    criado_em = models.DateTimeField(auto_now_add=True)
    removido_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "subscritores"
        ordering = ["-criado_em"]

    def __str__(self):
        return self.email


class Definicao(models.Model):
    """
    Definições da loja editáveis no painel.

    Guardadas como pares chave/valor para acrescentar um toggle novo não exigir
    uma migração de base de dados.
    """

    chave = models.CharField(max_length=60, primary_key=True)
    valor = models.JSONField()
    actualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "definicoes"
        verbose_name_plural = "definições"

    def __str__(self):
        return self.chave

    @classmethod
    def obter(cls, chave, omissao=None):
        registo = cls.objects.filter(chave=chave).first()
        return registo.valor if registo else omissao

    @classmethod
    def definir(cls, chave, valor):
        cls.objects.update_or_create(chave=chave, defaults={"valor": valor})
