"""
Testes do painel de administração.

    python manage.py test painel

Cobrem o CRUD de escrita (criar/editar/remover), a protecção contra remoção de
marcas/categorias com peças associadas, e as acções de negócio expostas no
painel (mudar estado, ajuste de stock em lote).
"""

from django.test import TestCase
from django.urls import reverse

from catalogo.models import Categoria, Marca, Produto, Variante
from contas.models import Utilizador
from encomendas.models import Cupao, Encomenda, EstadoEncomenda


class BasePainel(TestCase):
    def setUp(self):
        self.admin = Utilizador.objects.create_user(
            email="admin@teste.ao", password="Password1", primeiro_nome="A",
            apelido="B", papel=Utilizador.Papel.ADMIN,
        )
        self.client.login(username="admin@teste.ao", password="Password1")

        self.marca = Marca.objects.create(nome="Marca Teste")
        self.categoria = Categoria.objects.create(nome="Hoodies")
        self.produto = Produto.objects.create(
            nome="Hoodie Teste", descricao="Teste", preco=50000,
            marca=self.marca, categoria=self.categoria,
        )
        self.variante = Variante.objects.create(
            produto=self.produto, tamanho="M", cor_nome="Preto", sku="CP-T-0001", stock=2,
        )


class MarcaCRUDTests(BasePainel):
    def test_criar(self):
        resposta = self.client.post(reverse("painel:marca_nova"), {
            "nome": "Nova Marca", "assinatura": "", "descricao": "",
            "posicao": 0, "activa": "on",
        })
        self.assertEqual(resposta.status_code, 302)
        self.assertTrue(Marca.objects.filter(nome="Nova Marca").exists())

    def test_editar(self):
        self.client.post(reverse("painel:marca_editar", args=[self.marca.pk]), {
            "nome": "Marca Renomeada", "assinatura": "", "descricao": "",
            "posicao": 0, "activa": "on",
        })
        self.marca.refresh_from_db()
        self.assertEqual(self.marca.nome, "Marca Renomeada")

    def test_remover_sem_produtos(self):
        vazia = Marca.objects.create(nome="Sem Produtos")
        self.client.post(reverse("painel:marca_remover", args=[vazia.pk]))
        self.assertFalse(Marca.objects.filter(pk=vazia.pk).exists())

    def test_recusa_remover_com_produtos(self):
        # A marca tem uma peça associada (PROTECT) — remover destruiria o
        # histórico de catálogo em vez de simplesmente desactivar.
        self.client.post(reverse("painel:marca_remover", args=[self.marca.pk]))
        self.assertTrue(Marca.objects.filter(pk=self.marca.pk).exists())


class CategoriaCRUDTests(BasePainel):
    def test_criar(self):
        resposta = self.client.post(reverse("painel:categoria_nova"), {
            "nome": "Jeans", "descricao": "", "posicao": 0, "activa": "on",
        })
        self.assertEqual(resposta.status_code, 302)
        self.assertTrue(Categoria.objects.filter(nome="Jeans").exists())

    def test_recusa_remover_com_produtos(self):
        self.client.post(reverse("painel:categoria_remover", args=[self.categoria.pk]))
        self.assertTrue(Categoria.objects.filter(pk=self.categoria.pk).exists())


class CupaoCRUDTests(BasePainel):
    def test_criar(self):
        resposta = self.client.post(reverse("painel:cupao_novo"), {
            "codigo": "verao10", "tipo": Cupao.Tipo.PERCENTAGEM, "valor": 10, "activo": "on",
        })
        self.assertEqual(resposta.status_code, 302)
        # `save()` normaliza o código para maiúsculas.
        self.assertTrue(Cupao.objects.filter(codigo="VERAO10").exists())

    def test_remover(self):
        cupao = Cupao.objects.create(codigo="X", tipo=Cupao.Tipo.PERCENTAGEM, valor=5)
        self.client.post(reverse("painel:cupao_remover", args=[cupao.pk]))
        self.assertFalse(Cupao.objects.filter(pk=cupao.pk).exists())


class ProdutoCRUDTests(BasePainel):
    def _dados_produto(self, **overrides):
        dados = {
            "nome": "Peça Nova", "marca": self.marca.pk, "categoria": self.categoria.pk,
            "descricao": "Descrição", "detalhes": "", "preco": 60000, "preco_anterior": "",
            "distintivo": "", "meta_titulo": "", "meta_descricao": "",
            "variantes-TOTAL_FORMS": "0", "variantes-INITIAL_FORMS": "0",
            "variantes-MIN_NUM_FORMS": "0", "variantes-MAX_NUM_FORMS": "1000",
            "imagens-TOTAL_FORMS": "0", "imagens-INITIAL_FORMS": "0",
            "imagens-MIN_NUM_FORMS": "0", "imagens-MAX_NUM_FORMS": "1000",
        }
        dados.update(overrides)
        return dados

    def test_criar(self):
        resposta = self.client.post(reverse("painel:produto_novo"), self._dados_produto())
        self.assertEqual(resposta.status_code, 302)
        self.assertTrue(Produto.objects.filter(nome="Peça Nova").exists())

    def test_editar_actualiza_variante_existente(self):
        dados = self._dados_produto(nome=self.produto.nome, **{
            "variantes-TOTAL_FORMS": "1", "variantes-INITIAL_FORMS": "1",
            "variantes-MIN_NUM_FORMS": "0", "variantes-MAX_NUM_FORMS": "1000",
            "variantes-0-id": self.variante.pk,
            "variantes-0-tamanho": "M", "variantes-0-cor_nome": "Preto",
            "variantes-0-cor_hex": "#111111", "variantes-0-sku": "CP-T-0001",
            "variantes-0-stock": "9", "variantes-0-limiar_stock_baixo": "6",
            "variantes-0-preco_proprio": "",
        })
        self.client.post(reverse("painel:produto_editar", args=[self.produto.pk]), dados)
        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 9)

    def test_remover(self):
        self.client.post(reverse("painel:produto_remover", args=[self.produto.pk]))
        self.assertFalse(Produto.objects.filter(pk=self.produto.pk).exists())

    def test_exportar_csv(self):
        resposta = self.client.get(reverse("painel:produtos_exportar"))
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta["Content-Type"], "text/csv")
        self.assertIn(b"Hoodie Teste", resposta.content)


class ProdutoTransaccaoTests(ProdutoCRUDTests):
    """
    Uma variante inválida não pode deixar o produto meio criado: o formulário
    volta a aparecer e submetê-lo de novo criaria um segundo produto.
    """

    def test_variante_invalida_nao_cria_produto(self):
        dados = self._dados_produto(nome="Peça Com Variante Má", **{
            "variantes-TOTAL_FORMS": "1", "variantes-INITIAL_FORMS": "0",
            "variantes-MIN_NUM_FORMS": "0", "variantes-MAX_NUM_FORMS": "1000",
            "variantes-0-tamanho": "M", "variantes-0-cor_nome": "Preto",
            "variantes-0-cor_hex": "#111111",
            "variantes-0-sku": "",  # obrigatório — invalida a linha
            "variantes-0-stock": "5", "variantes-0-limiar_stock_baixo": "6",
            "variantes-0-preco_proprio": "",
        })
        resposta = self.client.post(reverse("painel:produto_novo"), dados)

        # Volta ao formulário (não redirecciona) e nada foi gravado.
        self.assertEqual(resposta.status_code, 200)
        self.assertFalse(Produto.objects.filter(nome="Peça Com Variante Má").exists())

    def test_variante_invalida_nao_altera_produto_existente(self):
        dados = self._dados_produto(nome="Nome Que Nao Deve Passar", **{
            "variantes-TOTAL_FORMS": "1", "variantes-INITIAL_FORMS": "1",
            "variantes-MIN_NUM_FORMS": "0", "variantes-MAX_NUM_FORMS": "1000",
            "variantes-0-id": self.variante.pk,
            "variantes-0-tamanho": "M", "variantes-0-cor_nome": "Preto",
            "variantes-0-cor_hex": "#111111", "variantes-0-sku": "",
            "variantes-0-stock": "99", "variantes-0-limiar_stock_baixo": "6",
            "variantes-0-preco_proprio": "",
        })
        self.client.post(reverse("painel:produto_editar", args=[self.produto.pk]), dados)

        self.produto.refresh_from_db()
        self.variante.refresh_from_db()
        self.assertEqual(self.produto.nome, "Hoodie Teste")
        self.assertEqual(self.variante.stock, 2)


class ModeracaoAvaliacoesTests(BasePainel):
    """
    A moderação cria-se directamente, sem passar pelos services: o que está a
    ser testado é o painel, não a regra de quem pode avaliar.
    """

    def setUp(self):
        super().setUp()
        from catalogo.models import Avaliacao

        self.cliente = Utilizador.objects.create_user(
            email="cliente@teste.ao", password="Password1", primeiro_nome="Ana", apelido="Miguel"
        )
        self.avaliacao = Avaliacao.objects.create(
            produto=self.produto, utilizador=self.cliente, estrelas=5, comentario="Muito boa."
        )

    def test_lista_abre(self):
        resposta = self.client.get(reverse("painel:avaliacoes"))
        self.assertEqual(resposta.status_code, 200)
        self.assertContains(resposta, "Muito boa.")

    def test_esconder_e_repor(self):
        url = reverse("painel:avaliacao_alternar", args=[self.avaliacao.pk])

        self.client.post(url)
        self.avaliacao.refresh_from_db()
        self.assertFalse(self.avaliacao.publicada)

        self.client.post(url)
        self.avaliacao.refresh_from_db()
        self.assertTrue(self.avaliacao.publicada)

    def test_esconder_retira_da_media(self):
        self.client.post(reverse("painel:avaliacao_alternar", args=[self.avaliacao.pk]))
        self.produto.refresh_from_db()
        self.assertIsNone(self.produto.media_avaliacoes)

    def test_remover(self):
        from catalogo.models import Avaliacao

        self.client.post(reverse("painel:avaliacao_remover", args=[self.avaliacao.pk]))
        self.assertFalse(Avaliacao.objects.filter(pk=self.avaliacao.pk).exists())

    def test_cliente_nao_modera(self):
        self.client.logout()
        self.client.login(username="cliente@teste.ao", password="Password1")

        resposta = self.client.post(reverse("painel:avaliacao_alternar", args=[self.avaliacao.pk]))
        self.assertEqual(resposta.status_code, 302)
        self.avaliacao.refresh_from_db()
        self.assertTrue(self.avaliacao.publicada)


class ReposicaoPeloPainelTests(BasePainel):
    """Repor stock no painel tem de avisar quem estava à espera."""

    def setUp(self):
        super().setUp()
        from catalogo.models import Variante
        from catalogo.services import registar_alerta

        Variante.objects.filter(produto=self.produto).update(stock=0)
        self.produto.refresh_from_db()
        registar_alerta(self.produto, "Ana", "ana@teste.ao", "+244900000000")

    def test_repor_stock_avisa_a_lista_de_espera(self):
        from django.core import mail

        from catalogo.models import AlertaReposicao

        self.client.post(reverse("painel:stock_ajustar"), {f"stock_{self.variante.pk}": "10"})

        self.assertFalse(AlertaReposicao.objects.get().pendente)
        self.assertEqual(len(mail.outbox), 1)

    def test_ajuste_sem_repor_nao_avisa(self):
        from django.core import mail

        from catalogo.models import AlertaReposicao

        # Continua a zero: não há nada para avisar.
        self.client.post(reverse("painel:stock_ajustar"), {f"stock_{self.variante.pk}": "0"})

        self.assertTrue(AlertaReposicao.objects.get().pendente)
        self.assertEqual(len(mail.outbox), 0)

    def test_peca_que_ja_tinha_stock_nao_dispara_avisos(self):
        from django.core import mail

        from catalogo.models import Variante

        Variante.objects.filter(pk=self.variante.pk).update(stock=5)
        self.client.post(reverse("painel:stock_ajustar"), {f"stock_{self.variante.pk}": "20"})
        self.assertEqual(len(mail.outbox), 0)

    def test_lista_de_espera_aparece_no_painel(self):
        resposta = self.client.get(reverse("painel:stock"))
        self.assertContains(resposta, "Lista de espera")
        self.assertContains(resposta, "ana@teste.ao")


class EntradasMalFormadasTests(BasePainel):
    """
    Os nomes dos campos e os valores vêm do cliente. Antes destas guardas, um
    POST forjado a partir do painel devolvia 500 em vez de uma mensagem.
    """

    def test_ajuste_de_stock_com_id_nao_numerico(self):
        resposta = self.client.post(reverse("painel:stock_ajustar"), {
            "stock_abc": "5",
            f"stock_{self.variante.pk}": "7",
        })
        self.assertEqual(resposta.status_code, 302)
        self.variante.refresh_from_db()
        # A linha válida passa; a forjada é simplesmente ignorada.
        self.assertEqual(self.variante.stock, 7)

    def test_estado_de_encomenda_desconhecido(self):
        encomenda = Encomenda.objects.create(
            referencia="CP-9003", nome_cliente="Cliente Teste", email="c@teste.ao",
            telefone="+244900000000", subtotal=50000, total=50000,
            provincia="Luanda", municipio="Talatona", rua="Rua Teste",
        )
        resposta = self.client.post(
            reverse("painel:encomenda_mudar_estado", args=[encomenda.referencia]),
            {"estado": "LIXO"},
        )
        self.assertEqual(resposta.status_code, 302)
        encomenda.refresh_from_db()
        self.assertEqual(encomenda.estado, EstadoEncomenda.NOVA)


class EncomendaEstadoTests(BasePainel):
    def test_mudar_estado(self):
        encomenda = Encomenda.objects.create(
            referencia="CP-9001", nome_cliente="Cliente Teste", email="c@teste.ao",
            telefone="+244900000000", subtotal=50000, total=50000,
            provincia="Luanda", municipio="Talatona", rua="Rua Teste",
        )
        self.client.post(
            reverse("painel:encomenda_mudar_estado", args=[encomenda.referencia]),
            {"estado": EstadoEncomenda.CONFIRMADA},
        )
        encomenda.refresh_from_db()
        self.assertEqual(encomenda.estado, EstadoEncomenda.CONFIRMADA)

    def test_transicao_invalida_nao_muda_nada(self):
        encomenda = Encomenda.objects.create(
            referencia="CP-9002", nome_cliente="Cliente Teste", email="c@teste.ao",
            telefone="+244900000000", subtotal=50000, total=50000,
            provincia="Luanda", municipio="Talatona", rua="Rua Teste",
        )
        self.client.post(
            reverse("painel:encomenda_mudar_estado", args=[encomenda.referencia]),
            {"estado": EstadoEncomenda.ENTREGUE},
        )
        encomenda.refresh_from_db()
        self.assertEqual(encomenda.estado, EstadoEncomenda.NOVA)


class StockAjusteTests(BasePainel):
    def test_ajusta_em_lote(self):
        outra = Variante.objects.create(
            produto=self.produto, tamanho="L", cor_nome="Preto", sku="CP-T-0002", stock=1,
        )
        self.client.post(reverse("painel:stock_ajustar"), {
            f"stock_{self.variante.pk}": "20",
            f"stock_{outra.pk}": "0",
        })
        self.variante.refresh_from_db()
        outra.refresh_from_db()
        self.assertEqual(self.variante.stock, 20)
        self.assertEqual(outra.stock, 0)

    def test_ignora_valores_negativos(self):
        self.client.post(reverse("painel:stock_ajustar"), {f"stock_{self.variante.pk}": "-5"})
        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 2)


class AcessoTests(BasePainel):
    def test_cliente_nao_acede_ao_crud(self):
        self.client.logout()
        Utilizador.objects.create_user(
            email="cliente@teste.ao", password="Password1", primeiro_nome="A", apelido="B"
        )
        self.client.login(username="cliente@teste.ao", password="Password1")
        resposta = self.client.get(reverse("painel:marca_nova"))
        self.assertEqual(resposta.status_code, 302)


class PaginasRenderizamTests(BasePainel):
    """Um smoke test por página nova — apanha erros de template que os testes de POST não veem."""

    SEM_ARGUMENTOS = [
        "painel:dashboard", "painel:produtos", "painel:marcas", "painel:categorias",
        "painel:cupoes", "painel:avaliacoes", "painel:encomendas", "painel:stock",
        "painel:definicoes", "painel:marca_nova", "painel:categoria_nova",
        "painel:cupao_novo", "painel:produto_novo",
    ]

    def _com_argumentos(self):
        return [
            ("painel:marca_editar", self.marca.pk),
            ("painel:categoria_editar", self.categoria.pk),
            ("painel:produto_editar", self.produto.pk),
        ]

    def test_todas_as_paginas_devolvem_200(self):
        for nome in self.SEM_ARGUMENTOS:
            with self.subTest(nome):
                self.assertEqual(self.client.get(reverse(nome)).status_code, 200)

        for nome, pk in self._com_argumentos():
            with self.subTest(nome):
                self.assertEqual(self.client.get(reverse(nome, args=[pk])).status_code, 200)

    def test_sem_sintaxe_de_template_visivel(self):
        """
        O painel é o código mais recente, logo o mais provável de trazer um
        comentário ou uma tag mal fechada até ao HTML servido.
        """
        alvos = [reverse(n) for n in self.SEM_ARGUMENTOS]
        alvos += [reverse(n, args=[pk]) for n, pk in self._com_argumentos()]

        for url in alvos:
            with self.subTest(url):
                corpo = self.client.get(url).content.decode("utf-8", errors="replace")
                for marca in ("{#", "#}", "{%", "{{"):
                    self.assertNotIn(marca, corpo, f"{marca!r} visível em {url}")
