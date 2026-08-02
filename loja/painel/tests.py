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

    def test_listas(self):
        for nome in ("painel:cupoes", "painel:stock", "painel:encomendas"):
            with self.subTest(nome):
                self.assertEqual(self.client.get(reverse(nome)).status_code, 200)

    def test_formularios_de_criacao(self):
        for nome in ("painel:marca_nova", "painel:categoria_nova", "painel:cupao_novo", "painel:produto_novo"):
            with self.subTest(nome):
                self.assertEqual(self.client.get(reverse(nome)).status_code, 200)

    def test_formularios_de_edicao(self):
        casos = [
            ("painel:marca_editar", self.marca.pk),
            ("painel:categoria_editar", self.categoria.pk),
            ("painel:produto_editar", self.produto.pk),
        ]
        for nome, pk in casos:
            with self.subTest(nome):
                self.assertEqual(self.client.get(reverse(nome, args=[pk])).status_code, 200)
