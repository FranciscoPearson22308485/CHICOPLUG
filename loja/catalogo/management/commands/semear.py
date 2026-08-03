"""
Semeia a loja com o catálogo multimarca de demonstração.

    python manage.py semear

As imagens vêm de `../frontend/src/assets` (as fotografias editoriais do
projecto), são optimizadas e copiadas para `media/`.
"""

import shutil
from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.utils.text import slugify

from catalogo.models import (
    Avaliacao,
    Categoria,
    Definicao,
    Favorito,
    FotoAvaliacao,
    ImagemProduto,
    Marca,
    Produto,
    Subscritor,
    Variante,
)
from contas.models import Morada, Utilizador
from encomendas.models import (
    Carrinho,
    Cupao,
    Encomenda,
    EstadoEncomenda,
    EstadoPagamento,
    EventoEncomenda,
    ItemCarrinho,
    ItemEncomenda,
    Pagamento,
    calcular_envio,
)

PRETO = ("Preto", "#111111")
BRANCO = ("Branco", "#FFFFFF")
CINZENTO = ("Cinzento", "#9A9A9A")
AZUL = ("Azul Claro", "#A8D2E8")
CRU = ("Cru", "#EDE7DC")
MARINHO = ("Azul-marinho", "#1B2A41")

CATEGORIAS = [
    "T-Shirts", "Hoodies", "Jeans", "Sneakers",
    "Calças", "Casacos", "Bonés", "Acessórios",
]

MARCAS = [
    ("Nike", "Sportswear icónico desde 1964",
     "O maior nome do sportswear mundial. Silhuetas que atravessaram gerações e continuam a definir o que se veste na rua.",
     "editorial-1.jpg", True),
    ("Jordan", "O legado que calçou o basquetebol",
     "Nascida no parquet, adoptada pela rua. A Jumpman é hoje tão cultural quanto desportiva.",
     "p4.jpg", True),
    ("Adidas", "Três riscas, alcance global",
     "Do terreno de jogo ao streetwear. Peças reconhecíveis à distância, com o conforto de quem faz isto há décadas.",
     "p2.jpg", True),
    ("Corteiz", "Londres, sem pedir licença",
     "A marca que fez do lançamento-relâmpago uma linguagem própria. Quantidades curtas, procura enorme.",
     "editorial-2.jpg", True),
    ("Represent", "Alfaiataria aplicada ao streetwear",
     "Manchester. Gramagens pesadas e cortes trabalhados, num registo mais sóbrio do que o habitual no género.",
     "p1.jpg", True),
    ("Hellstar", "Gráfica crua, atitude directa",
     "Estampados densos e uma estética que não procura agradar a todos. Das marcas mais procuradas da nova vaga.",
     "p3.jpg", True),
    ("Denim Tears", "Denim com memória",
     "Tremaine Emory transformou o algodão num discurso sobre história e identidade. Peças com peso simbólico.",
     "p5.jpg", True),
    ("Essentials", "O básico elevado",
     "A linha acessível da Fear of God. Paleta neutra, caimento generoso, o núcleo de qualquer guarda-roupa.",
     "p6.jpg", True),
    ("Gallery Dept", "Arte vestível de Los Angeles",
     "Cada peça é intervencionada à mão. Nenhuma sai exactamente igual à anterior.",
     "editorial-1.jpg", False),
]

SNEAKERS = ["39", "40", "41", "42", "43", "44", "45"]
VESTUARIO = ["S", "M", "L", "XL", "XXL"]
VESTUARIO_XS = ["XS", "S", "M", "L", "XL"]
CINTURA = ["28", "30", "32", "34", "36"]
UNICO = ["Tamanho único"]

# (nome, marca, categoria, preço, preço anterior, cores, tamanhos, imagens,
#  distintivo, stock, novidade, mais vendido, descrição, detalhes)
PRODUTOS = [
    ("Tech Fleece Hoodie", "Nike", "Hoodies", 128000, None, [PRETO, CINZENTO], VESTUARIO,
     ["p1.jpg", "editorial-2.jpg", "p3.jpg"], "", 18, True, True,
     "O Tech Fleece continua a ser a referência em conforto térmico sem volume. Corte limpo, fecho integral e bolsos laterais com zíper.",
     ["Tecido Tech Fleece", "Fecho integral", "Bolsos com zíper", "Capuz forrado"]),
    ("Air Force 1 '07", "Nike", "Sneakers", 96000, 118000, [BRANCO, PRETO], SNEAKERS,
     ["p2.jpg", "p6.jpg", "editorial-1.jpg"], "", 24, False, True,
     "O ténis que nunca saiu de circulação. Pele lisa, entressola Air e a silhueta que atravessou quatro décadas intacta.",
     ["Pele natural", "Amortecimento Nike Air", "Sola de borracha", "Modelo unissexo"]),
    ("Sportswear Cap", "Nike", "Bonés", 32000, None, [PRETO, BRANCO], UNICO,
     ["p6.jpg", "p2.jpg", "editorial-2.jpg"], "", 30, False, False,
     "Boné de sarja com Swoosh bordado e fecho traseiro ajustável. Aba pré-curvada.",
     ["Sarja de algodão", "Swoosh bordado", "Fecho ajustável", "Aba pré-curvada"]),
    ("Flight Essentials Tee", "Jordan", "T-Shirts", 42000, None, [BRANCO, PRETO, CINZENTO], VESTUARIO_XS,
     ["p2.jpg", "editorial-1.jpg", "p6.jpg"], "NOVO", 36, True, False,
     "Jersey de algodão pesado com Jumpman bordado ao peito. Caimento descontraído sem perder estrutura.",
     ["100% algodão", "Jumpman bordado", "Corte descontraído", "Gola reforçada"]),
    ("1 Mid", "Jordan", "Sneakers", 152000, None, [PRETO, BRANCO], SNEAKERS,
     ["p4.jpg", "editorial-1.jpg", "p2.jpg"], "", 9, False, True,
     "A silhueta mais reconhecível do calçado desportivo, na altura intermédia. Pele de primeira e acabamentos cuidados.",
     ["Cabedal premium", "Cano médio", "Unidade Air encapsulada", "Ilhós metálicos"]),
    ("Originals Trefoil Hoodie", "Adidas", "Hoodies", 88000, 108000, [CINZENTO, PRETO, MARINHO], VESTUARIO,
     ["p3.jpg", "p1.jpg", "editorial-2.jpg"], "", 21, False, False,
     "Felpo escovado com o Trefoil aplicado ao peito. O casaco de capuz que funciona em qualquer contexto.",
     ["Felpo de algodão", "Trefoil aplicado", "Bolso canguru", "Punhos canelados"]),
    ("Samba OG", "Adidas", "Sneakers", 84000, None, [BRANCO, PRETO], SNEAKERS,
     ["p6.jpg", "p2.jpg", "editorial-1.jpg"], "", 15, True, True,
     "Do salão de futebol para a rua. Perfil baixo, biqueira em camurça e sola de goma — um clássico que voltou a dominar.",
     ["Pele e camurça", "Sola de goma", "Perfil baixo", "Modelo unissexo"]),
    ("Alcatraz Cargo", "Corteiz", "Calças", 116000, None, [PRETO, CINZENTO], VESTUARIO,
     ["p3.jpg", "editorial-2.jpg", "p1.jpg"], "ULTIMAS_UNIDADES", 5, False, False,
     "Cargo de perna larga com bolsos utilitários e o logótipo Alcatraz aplicado. Produção sempre curta.",
     ["Sarja resistente", "Perna larga", "Bolsos utilitários", "Cintura ajustável"]),
    ("4Starz Tee", "Corteiz", "T-Shirts", 54000, None, [PRETO, BRANCO], VESTUARIO,
     ["p2.jpg", "p6.jpg", "editorial-1.jpg"], "", 12, True, False,
     "Estampado 4Starz em serigrafia sobre jersey pesado. Uma das peças mais procuradas da marca.",
     ["Jersey 220gsm", "Serigrafia", "Corte boxy", "Etiqueta tecida"]),
    ("Bolo Cap", "Corteiz", "Bonés", 38000, None, [PRETO, MARINHO], UNICO,
     ["p6.jpg", "editorial-2.jpg", "p2.jpg"], "", 14, True, False,
     "Boné com o Alcatraz bordado à frente. Um dos acessórios mais procurados da marca.",
     ["Sarja pesada", "Alcatraz bordado", "Fecho metálico", "Interior forrado"]),
    ("Owners Club Hoodie", "Represent", "Hoodies", 168000, None, [CRU, PRETO], VESTUARIO,
     ["p1.jpg", "p3.jpg", "editorial-2.jpg"], "", 8, False, True,
     "Felpo de 400gsm com lavagem pigmentada e o Owners Club aplicado em relevo. Envelhece bem com o uso.",
     ["Felpo 400gsm", "Lavagem pigmentada", "Aplicação em relevo", "Corte oversized"]),
    ("Initial Jacket", "Represent", "Casacos", 224000, None, [PRETO], VESTUARIO,
     ["p4.jpg", "editorial-1.jpg", "p2.jpg"], "", 4, False, False,
     "Casaco em nylon mate com forro acolchoado e bolso utilitário. Estrutura pensada para durar estações.",
     ["Nylon mate", "Forro acolchoado", "Zíper YKK", "Bolso interior"]),
    ("Studios Sweatpants", "Hellstar", "Calças", 98000, 124000, [CINZENTO, PRETO], VESTUARIO,
     ["p3.jpg", "p1.jpg", "editorial-2.jpg"], "", 11, False, False,
     "Calças de fato de treino em felpo escovado com gráfica aplicada na perna. Cintura elástica e cordão plano.",
     ["Felpo 420gsm", "Gráfica aplicada", "Cintura elástica", "Bolsos laterais"]),
    ("Records Tee", "Hellstar", "T-Shirts", 58000, None, [PRETO, BRANCO], VESTUARIO,
     ["p2.jpg", "editorial-1.jpg", "p6.jpg"], "NOVO", 16, True, False,
     "Estampado integral frente e costas sobre algodão pesado. Uma das peças mais reconhecíveis da marca.",
     ["Algodão 240gsm", "Estampado frente e costas", "Corte largo", "Gola dupla"]),
    ("Cotton Wreath Jeans", "Denim Tears", "Jeans", 186000, None, [AZUL], CINTURA,
     ["p5.jpg", "editorial-1.jpg", "p2.jpg"], "", 6, True, False,
     "Denim rígido com a coroa de algodão aplicada — o motivo que define a marca. Lavagem média, corte recto.",
     ["Denim 13oz", "Coroa de algodão aplicada", "Corte recto", "Botões metálicos"]),
    ("Trucker Jacket", "Denim Tears", "Casacos", 212000, None, [AZUL], VESTUARIO,
     ["p5.jpg", "p2.jpg", "editorial-2.jpg"], "", 0, False, False,
     "Trucker em denim rígido com lavagem feita à mão e costuras contrastantes. Peça de arquivo.",
     ["Denim 13oz", "Lavagem manual", "Costuras contrastantes", "Unissexo"]),
    ("Oversized Hoodie", "Essentials", "Hoodies", 112000, None, [CRU, CINZENTO, PRETO], VESTUARIO,
     ["p1.jpg", "editorial-2.jpg", "p3.jpg"], "", 28, False, True,
     "Felpo pesado em tons neutros com o logótipo emborrachado ao peito. O caimento oversized que definiu a linha.",
     ["Felpo pesado", "Logótipo emborrachado", "Ombro descaído", "Punhos canelados"]),
    ("Relaxed Sweatpants", "Essentials", "Calças", 92000, 112000, [CRU, CINZENTO], VESTUARIO,
     ["p3.jpg", "p1.jpg", "p6.jpg"], "", 19, False, False,
     "Conjunto natural do hoodie. Perna relaxada, cintura elástica e o mesmo felpo pesado.",
     ["Felpo pesado", "Perna relaxada", "Cintura elástica", "Logótipo emborrachado"]),
    ("Beanie", "Essentials", "Acessórios", 28000, 36000, [CRU, PRETO, CINZENTO], UNICO,
     ["p6.jpg", "p2.jpg", "p1.jpg"], "", 22, False, False,
     "Gorro em malha canelada com etiqueta tecida. Tons neutros, uso diário.",
     ["Malha canelada", "Etiqueta tecida", "Tamanho único", "Interior macio"]),
    ("Painted Tee", "Gallery Dept", "T-Shirts", 148000, None, [BRANCO, CRU], VESTUARIO,
     ["p6.jpg", "editorial-1.jpg", "p2.jpg"], "ULTIMAS_UNIDADES", 3, False, False,
     "Intervencionada à mão em Los Angeles. Cada peça tem manchas e desgaste únicos — nenhuma é igual à seguinte.",
     ["Pintada à mão", "Algodão vintage", "Peça única", "Desgaste intencional"]),
]

ASSETS = Path(settings.BASE_DIR).parent / "frontend" / "src" / "assets"


def distribuir(total, baldes):
    """Reparte o stock pelas variantes, dando o resto às primeiras."""
    if baldes == 0:
        return []
    base, resto = divmod(total, baldes)
    return [base + (1 if i < resto else 0) for i in range(baldes)]


# Clientes de demonstração. Espalhados por várias províncias para a galeria e
# os relatórios por cidade terem alguma coisa que mostrar.
CLIENTES_DEMO = [
    ("Ana", "Miguel", "ana.miguel@exemplo.ao", "Luanda", "Talatona"),
    ("Nuno", "Bengui", "nuno.bengui@exemplo.ao", "Luanda", "Viana"),
    ("Márcia", "Kiala", "marcia.kiala@exemplo.ao", "Benguela", "Lobito"),
    ("Edson", "Cabral", "edson.cabral@exemplo.ao", "Huíla", "Lubango"),
    ("Telma", "Ndala", "telma.ndala@exemplo.ao", "Luanda", "Belas"),
]

# (estrelas, comentário, leva fotografia?)
AVALIACOES_DEMO = [
    (5, "Chegou em três dias a Luanda. O tecido é bem mais pesado do que esperava — vale o preço.", True),
    (5, "Original, sem dúvida. Já é a segunda peça que compro aqui e a qualidade mantém-se.", True),
    (4, "Muito boa peça. Só tirei uma estrela porque veste um pouco largo, encomendem um tamanho abaixo.", False),
    (5, "Exactamente igual às fotografias. A costura é impecável.", True),
    (4, "Gostei bastante. A entrega demorou um dia mais do que o previsto, mas nada de grave.", False),
    (3, "A peça é boa mas a cor é um pouco mais escura do que aparece no site.", False),
    (5, "O melhor sítio para comprar streetwear em Angola. Atendimento rápido e peça genuína.", True),
    (4, "Confortável e bem cortada. Recomendo.", False),
]


class Command(BaseCommand):
    help = "Semeia a loja com o catálogo multimarca de demonstração."

    def add_arguments(self, parser):
        parser.add_argument(
            "--sem-imagens",
            action="store_true",
            help="Não copia as fotografias (mais rápido, mas o catálogo fica sem imagens).",
        )

    def handle(self, *args, **opcoes):
        copiar_imagens = not opcoes["sem_imagens"] and ASSETS.exists()
        if not copiar_imagens and not opcoes["sem_imagens"]:
            self.stdout.write(self.style.WARNING(f"  ! Sem imagens: {ASSETS} não existe."))

        with transaction.atomic():
            self._limpar()
            categorias = self._categorias()
            marcas = self._marcas(copiar_imagens)
            self._produtos(categorias, marcas, copiar_imagens)
            self._custos()
            self._contas()
            self._encomendas_e_avaliacoes()
            self._cupoes()
            self._definicoes()

        promos = sum(1 for p in PRODUTOS if p[4])
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("✔ Seed concluído."))
        self.stdout.write(
            f"  {len(MARCAS)} marcas · {len(CATEGORIAS)} categorias · "
            f"{len(PRODUTOS)} produtos ({promos} em promoção)"
        )
        self.stdout.write(
            f"  {getattr(self, 'total_encomendas', 0)} encomendas entregues · "
            f"{getattr(self, 'total_avaliacoes', 0)} avaliações"
        )
        self.stdout.write("  Admin:   admin@chicoplug.ao / ChicoPlug!2026")
        self.stdout.write("  Cliente: cliente@chicoplug.ao / Cliente!2026")

    # ── Passos ───────────────────────────────────────────────────────────────

    def _limpar(self):
        self.stdout.write("→ A limpar dados existentes…")
        for modelo in (
            EventoEncomenda, Pagamento, ItemEncomenda, Encomenda,
            ItemCarrinho, Carrinho, Favorito, Morada,
            FotoAvaliacao, Avaliacao,
            ImagemProduto, Variante, Produto, Marca, Categoria,
            Cupao, Subscritor, Utilizador, Definicao,
        ):
            modelo.objects.all().delete()

        media = Path(settings.MEDIA_ROOT)
        if media.exists():
            shutil.rmtree(media, ignore_errors=True)

    def _categorias(self):
        self.stdout.write("→ Categorias…")
        return {
            nome: Categoria.objects.create(nome=nome, slug=slugify(nome), posicao=i)
            for i, nome in enumerate(CATEGORIAS)
        }

    def _marcas(self, copiar):
        self.stdout.write("→ Marcas…")
        marcas = {}
        for i, (nome, assinatura, descricao, ficheiro, destaque) in enumerate(MARCAS):
            marca = Marca(
                nome=nome,
                slug=slugify(nome),
                assinatura=assinatura,
                descricao=descricao,
                destaque=destaque,
                posicao=i,
            )
            if copiar:
                dados = self._ler(ficheiro)
                if dados:
                    marca.imagem.save(f"{slugify(nome)}.jpg", ContentFile(dados), save=False)
            marca.save()
            marcas[nome] = marca
        return marcas

    def _produtos(self, categorias, marcas, copiar):
        self.stdout.write("→ Produtos e variantes…")
        # `buildSku` trunca o nome, por isso duas peças da mesma marca podiam
        # gerar o mesmo SKU no mesmo tamanho e cor. O contador global evita-o.
        contador = 0

        for (nome, marca_nome, cat_nome, preco, anterior, cores, tamanhos,
             ficheiros, distintivo, stock, novidade, mais_vendido, descricao, detalhes) in PRODUTOS:

            produto = Produto.objects.create(
                nome=nome,
                slug=slugify(f"{marca_nome} {nome}")[:180],
                descricao=descricao,
                detalhes="\n".join(detalhes),
                preco=preco,
                preco_anterior=anterior,
                marca=marcas[marca_nome],
                categoria=categorias[cat_nome],
                distintivo=distintivo,
                novidade=novidade,
                mais_vendido=mais_vendido,
                meta_titulo=f"{marca_nome} {nome} — CHICOPLUG",
                meta_descricao=descricao[:155],
            )

            if copiar:
                for pos, ficheiro in enumerate(ficheiros):
                    dados = self._ler(ficheiro)
                    if not dados:
                        continue
                    imagem = ImagemProduto(
                        produto=produto,
                        posicao=pos,
                        texto_alternativo=f"{marca_nome} {nome} — vista {pos + 1}",
                    )
                    imagem.ficheiro.save(
                        f"{produto.slug}-{pos}.jpg", ContentFile(dados), save=False
                    )
                    imagem.save()

            combinacoes = [(t, c) for t in tamanhos for c in cores]
            por_variante = distribuir(stock, len(combinacoes))

            Variante.objects.bulk_create(
                [
                    Variante(
                        produto=produto,
                        tamanho=tamanho,
                        cor_nome=cor[0],
                        cor_hex=cor[1],
                        sku=f"CP-{slugify(marca_nome)[:4].upper()}-{contador + i:04d}",
                        stock=por_variante[i],
                    )
                    for i, (tamanho, cor) in enumerate(combinacoes)
                ]
            )
            contador += len(combinacoes)

    def _contas(self):
        self.stdout.write("→ Contas…")
        Utilizador.objects.create_user(
            email="admin@chicoplug.ao",
            password="ChicoPlug!2026",
            primeiro_nome="Chico",
            apelido="Admin",
            telefone="+244900000000",
            papel=Utilizador.Papel.ADMIN,
            is_staff=True,
        )
        cliente = Utilizador.objects.create_user(
            email="cliente@chicoplug.ao",
            password="Cliente!2026",
            primeiro_nome="Chico",
            apelido="Plug",
            telefone="+244900000001",
        )
        Morada.objects.create(
            utilizador=cliente,
            etiqueta="Casa",
            destinatario="Chico Plug",
            telefone="+244900000000",
            provincia="Luanda",
            municipio="Talatona",
            rua="Rua Amílcar Cabral, 42",
            principal=True,
        )

    def _custos(self):
        """
        Preço de custo de demonstração, para o dashboard ter lucro e margem.

        A revenda multimarca trabalha tipicamente com o custo entre 40% e 50%
        do preço de venda; usamos 45%, variando ligeiramente por peça para as
        margens do relatório não saírem todas iguais.
        """
        self.stdout.write("→ Preços de custo…")
        for posicao, produto in enumerate(Produto.objects.order_by("id")):
            fraccao = 0.42 + (posicao % 5) * 0.02
            Produto.objects.filter(pk=produto.pk).update(
                preco_custo=int(produto.preco * fraccao)
            )

    def _encomendas_e_avaliacoes(self):
        """
        Histórico de compras entregues e as avaliações que delas resultam.

        Sem isto a loja fica sem nada que dependa de uma compra: ninguém pode
        avaliar, a galeria fica vazia e os relatórios não têm receita. As
        encomendas ficam ENTREGUE e com o trilho de eventos completo, para o
        painel e o histórico do cliente mostrarem um percurso real.
        """
        self.stdout.write("→ Encomendas entregues e avaliações…")

        produtos = list(Produto.objects.filter(activo=True).order_by("id"))
        if not produtos:
            return

        agora = timezone.now()
        referencia = 2041
        indice_comentario = 0
        total_avaliacoes = 0

        for posicao, (nome, apelido, email, provincia, municipio) in enumerate(CLIENTES_DEMO):
            cliente = Utilizador.objects.create_user(
                email=email, password="Cliente!2026",
                primeiro_nome=nome, apelido=apelido,
                telefone=f"+2449001112{posicao:02d}",
            )
            Morada.objects.create(
                utilizador=cliente, etiqueta="Casa", destinatario=f"{nome} {apelido}",
                telefone=f"+2449001112{posicao:02d}", provincia=provincia,
                municipio=municipio, rua=f"Rua {posicao + 1}, nº {10 + posicao}", principal=True,
            )

            # Cada cliente compra duas peças, escolhidas de forma espaçada para
            # as avaliações não caírem todas no mesmo produto.
            escolhidos = [
                produtos[(posicao * 3) % len(produtos)],
                produtos[(posicao * 3 + 1) % len(produtos)],
            ]
            variantes = [p.variantes.filter(activa=True).first() for p in escolhidos]
            variantes = [v for v in variantes if v]
            if not variantes:
                continue

            subtotal = sum(v.preco for v in variantes)
            envio = calcular_envio(subtotal)
            criada_em = agora - timezone.timedelta(days=25 - posicao * 4)

            encomenda = Encomenda.objects.create(
                referencia=f"CP-{referencia}", utilizador=cliente,
                nome_cliente=f"{nome} {apelido}", email=email,
                telefone=f"+2449001112{posicao:02d}",
                estado=EstadoEncomenda.ENTREGUE,
                subtotal=subtotal, envio=envio, total=subtotal + envio,
                provincia=provincia, municipio=municipio,
                rua=f"Rua {posicao + 1}, nº {10 + posicao}",
            )
            # auto_now_add ignora o valor passado ao criar; corrigimos depois
            # para o histórico não ficar todo com a data de hoje.
            Encomenda.objects.filter(pk=encomenda.pk).update(criado_em=criada_em)
            referencia += 1

            for variante in variantes:
                ItemEncomenda.objects.create(
                    encomenda=encomenda, variante=variante,
                    marca=variante.produto.marca.nome, nome_produto=variante.produto.nome,
                    slug_produto=variante.produto.slug,
                    url_imagem=variante.produto.imagem_principal or "",
                    tamanho=variante.tamanho, cor_nome=variante.cor_nome, sku=variante.sku,
                    preco_unitario=variante.preco, quantidade=1, total_linha=variante.preco,
                )
                # Mantém o stock coerente com o que foi vendido.
                Variante.objects.filter(pk=variante.pk).update(stock=F("stock") - 1)

            Pagamento.objects.create(
                encomenda=encomenda, provedor="simulador", estado=EstadoPagamento.PAGO,
                montante=encomenda.total, referencia=f"CPP-DEMO{referencia:04d}",
                pago_em=criada_em,
            )

            # Trilho completo, para o tracking do cliente ter o que mostrar.
            percurso = [
                ("", EstadoEncomenda.NOVA, "Encomenda criada."),
                (EstadoEncomenda.NOVA, EstadoEncomenda.CONFIRMADA, "Pagamento confirmado (simulador)."),
                (EstadoEncomenda.CONFIRMADA, EstadoEncomenda.EM_PREPARACAO, "A preparar a encomenda."),
                (EstadoEncomenda.EM_PREPARACAO, EstadoEncomenda.ENVIADA, "Entregue à transportadora."),
                (EstadoEncomenda.ENVIADA, EstadoEncomenda.ENTREGUE, "Entregue ao cliente."),
            ]
            for passo, (anterior, novo, nota) in enumerate(percurso):
                evento = EventoEncomenda.objects.create(
                    encomenda=encomenda, estado_anterior=anterior, estado_novo=novo, nota=nota,
                )
                EventoEncomenda.objects.filter(pk=evento.pk).update(
                    criado_em=criada_em + timezone.timedelta(days=passo)
                )

            # E a avaliação que resulta da compra.
            for variante in variantes:
                estrelas, comentario, com_foto = AVALIACOES_DEMO[indice_comentario % len(AVALIACOES_DEMO)]
                indice_comentario += 1

                avaliacao = Avaliacao.objects.create(
                    produto=variante.produto, utilizador=cliente,
                    estrelas=estrelas, comentario=comentario, compra_verificada=True,
                )
                Avaliacao.objects.filter(pk=avaliacao.pk).update(
                    criado_em=criada_em + timezone.timedelta(days=6)
                )
                total_avaliacoes += 1

                # A fotografia do cliente reutiliza a imagem da peça: é a única
                # fotografia real disponível no repositório.
                if com_foto:
                    imagem = variante.produto.imagens.first()
                    if imagem and imagem.ficheiro:
                        imagem.ficheiro.open("rb")
                        conteudo = imagem.ficheiro.read()
                        imagem.ficheiro.close()
                        foto = FotoAvaliacao(avaliacao=avaliacao)
                        foto.ficheiro.save(
                            f"avaliacao-{avaliacao.pk}.jpg", ContentFile(conteudo), save=True
                        )

        self.total_encomendas = len(CLIENTES_DEMO)
        self.total_avaliacoes = total_avaliacoes

    def _cupoes(self):
        self.stdout.write("→ Cupões…")
        Cupao.objects.create(
            codigo="BEMVINDO", tipo=Cupao.Tipo.VALOR_FIXO, valor=5000,
            subtotal_minimo=30000, max_utilizacoes=200,
        )
        Cupao.objects.create(
            codigo="STREET10", tipo=Cupao.Tipo.PERCENTAGEM, valor=10, subtotal_minimo=80000,
        )

    def _definicoes(self):
        Definicao.definir("nome_loja", "CHICOPLUG")
        Definicao.definir("email_contacto", "ola@chicoplug.ao")
        Definicao.definir("loja_activa", True)
        Definicao.definir("multicaixa_activo", True)
        Definicao.definir("newsletter_activa", True)

    # ── Auxiliares ───────────────────────────────────────────────────────────

    def _ler(self, ficheiro):
        caminho = ASSETS / ficheiro
        if not caminho.exists():
            return None
        # Recomprime para reduzir o peso sem perder qualidade visível.
        try:
            from PIL import Image

            with Image.open(caminho) as img:
                img = img.convert("RGB")
                img.thumbnail((1600, 2000))
                buffer = BytesIO()
                img.save(buffer, format="JPEG", quality=82, optimize=True)
                return buffer.getvalue()
        except Exception:
            return caminho.read_bytes()
