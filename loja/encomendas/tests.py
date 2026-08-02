"""
Testes das regras de negócio da loja.

    python manage.py test

Cobrem o que quebra dinheiro ou stock: a máquina de estados, os cupões, o
carrinho e a prevenção de venda a descoberto.
"""

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from catalogo.models import Categoria, Marca, Produto, Variante
from contas.models import Utilizador

from .models import Cupao, EstadoEncomenda, calcular_envio, deve_repor_stock, pode_transitar
from .services import ErroDeNegocio, StockInsuficiente, criar_encomenda, mudar_estado


class MaquinaDeEstadosTests(TestCase):
    def test_percurso_feliz(self):
        self.assertTrue(pode_transitar("NOVA", "CONFIRMADA"))
        self.assertTrue(pode_transitar("CONFIRMADA", "EM_PREPARACAO"))
        self.assertTrue(pode_transitar("EM_PREPARACAO", "ENVIADA"))
        self.assertTrue(pode_transitar("ENVIADA", "ENTREGUE"))

    def test_recusa_saltar_etapas(self):
        self.assertFalse(pode_transitar("NOVA", "ENVIADA"))
        self.assertFalse(pode_transitar("NOVA", "ENTREGUE"))

    def test_recusa_retroceder(self):
        self.assertFalse(pode_transitar("ENVIADA", "EM_PREPARACAO"))
        self.assertFalse(pode_transitar("CONFIRMADA", "NOVA"))

    def test_cancelar_ate_ao_envio(self):
        for estado in ("NOVA", "CONFIRMADA", "EM_PREPARACAO", "ENVIADA"):
            self.assertTrue(pode_transitar(estado, "CANCELADA"))

    def test_entregue_e_final(self):
        # Uma devolução é outro processo, não um retrocesso de estado.
        self.assertFalse(pode_transitar("ENTREGUE", "CANCELADA"))
        self.assertFalse(pode_transitar("CANCELADA", "NOVA"))

    def test_reposicao_de_stock(self):
        self.assertTrue(deve_repor_stock("CONFIRMADA", "CANCELADA"))
        self.assertFalse(deve_repor_stock("NOVA", "CONFIRMADA"))
        self.assertFalse(deve_repor_stock("ENTREGUE", "CANCELADA"))


class EnvioTests(TestCase):
    def test_carrinho_vazio_nao_paga_envio(self):
        self.assertEqual(calcular_envio(0), 0)

    def test_abaixo_do_limiar_paga(self):
        self.assertEqual(calcular_envio(99999), 3500)

    def test_no_limiar_e_gratis(self):
        self.assertEqual(calcular_envio(100000), 0)


class CupaoTests(TestCase):
    def test_percentagem(self):
        c = Cupao(codigo="X", tipo=Cupao.Tipo.PERCENTAGEM, valor=10)
        self.assertEqual(c.desconto_para(156000), 15600)

    def test_arredonda_para_baixo(self):
        # Arredondar para cima faria o total não bater com a soma das linhas.
        c = Cupao(codigo="X", tipo=Cupao.Tipo.PERCENTAGEM, valor=33)
        self.assertEqual(c.desconto_para(1001), 330)

    def test_nunca_excede_o_subtotal(self):
        c = Cupao(codigo="X", tipo=Cupao.Tipo.VALOR_FIXO, valor=50000)
        self.assertEqual(c.desconto_para(20000), 20000)

    def test_expirado_e_recusado(self):
        c = Cupao.objects.create(
            codigo="VELHO", tipo=Cupao.Tipo.PERCENTAGEM, valor=10,
            termina_em=timezone.now() - timezone.timedelta(days=1),
        )
        self.assertIsNotNone(c.erro_para(100000))
        self.assertEqual(c.estado_efectivo, "EXPIRADO")

    def test_subtotal_minimo(self):
        c = Cupao.objects.create(
            codigo="MIN", tipo=Cupao.Tipo.PERCENTAGEM, valor=10, subtotal_minimo=200000
        )
        self.assertIsNotNone(c.erro_para(100000))
        self.assertIsNone(c.erro_para(200000))


class BaseLoja(TestCase):
    def setUp(self):
        self.marca = Marca.objects.create(nome="Marca Teste", slug="marca-teste")
        self.categoria = Categoria.objects.create(nome="Hoodies", slug="hoodies")
        self.produto = Produto.objects.create(
            nome="Hoodie Teste", slug="marca-teste-hoodie-teste",
            descricao="Teste", preco=50000, marca=self.marca, categoria=self.categoria,
        )
        self.variante = Variante.objects.create(
            produto=self.produto, tamanho="M", cor_nome="Preto",
            cor_hex="#111111", sku="CP-T-0001", stock=10,
        )
        self.escassa = Variante.objects.create(
            produto=self.produto, tamanho="L", cor_nome="Preto",
            cor_hex="#111111", sku="CP-T-0002", stock=1,
        )

    def adicionar(self, variante=None, quantidade=1):
        return self.client.post(
            reverse("encomendas:adicionar"),
            {"variante": (variante or self.variante).pk, "quantidade": quantidade},
        )


class CarrinhoTests(BaseLoja):
    def test_funciona_sem_conta(self):
        self.adicionar(quantidade=2)
        resposta = self.client.get(reverse("encomendas:carrinho"))
        self.assertContains(resposta, "Hoodie Teste")

    def test_soma_quantidades(self):
        self.adicionar(quantidade=2)
        self.adicionar(quantidade=3)
        # Verificação directa na base: uma linha só, com a soma.
        from .models import ItemCarrinho

        item = ItemCarrinho.objects.get(variante=self.variante)
        self.assertEqual(item.quantidade, 5)

    def test_recusa_mais_do_que_ha_em_stock(self):
        resposta = self.adicionar(self.escassa, quantidade=2)
        self.assertEqual(resposta.status_code, 302)
        from .models import ItemCarrinho

        self.assertFalse(ItemCarrinho.objects.filter(variante=self.escassa).exists())

    def test_aceita_exactamente_o_stock(self):
        self.adicionar(self.escassa, quantidade=1)
        from .models import ItemCarrinho

        self.assertTrue(ItemCarrinho.objects.filter(variante=self.escassa).exists())


class CheckoutTests(BaseLoja):
    DADOS = {
        "accao": "finalizar",
        "nome": "Ana Miguel",
        "email": "ana@chicoplug.ao",
        "telefone": "+244900111222",
        "provincia": "Luanda",
        "municipio": "Talatona",
        "rua": "Rua Amílcar Cabral, 42",
    }

    def test_cria_encomenda_e_decrementa_stock(self):
        self.adicionar(quantidade=3)
        self.client.post(reverse("encomendas:checkout"), self.DADOS)

        from .models import Encomenda

        encomenda = Encomenda.objects.first()
        self.assertIsNotNone(encomenda)
        self.assertEqual(encomenda.estado, EstadoEncomenda.NOVA)
        self.assertTrue(encomenda.referencia.startswith("CP-"))

        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 7)

    def test_guarda_instantaneo_do_produto(self):
        self.adicionar()
        self.client.post(reverse("encomendas:checkout"), self.DADOS)

        from .models import ItemEncomenda

        item = ItemEncomenda.objects.first()
        self.assertEqual(item.preco_unitario, 50000)

        # Alterar o catálogo não pode reescrever o histórico de compras.
        self.produto.preco = 99999
        self.produto.nome = "Nome Novo"
        self.produto.save()

        item.refresh_from_db()
        self.assertEqual(item.preco_unitario, 50000)
        self.assertEqual(item.nome_produto, "Hoodie Teste")

    def test_impede_venda_a_descoberto(self):
        self.adicionar(self.escassa, quantidade=1)

        # Alguém comprou a última peça entre o carrinho e o pagamento.
        Variante.objects.filter(pk=self.escassa.pk).update(stock=0)

        self.client.post(reverse("encomendas:checkout"), self.DADOS)

        from .models import Encomenda

        self.assertEqual(Encomenda.objects.count(), 0)
        self.escassa.refresh_from_db()
        # O stock nunca pode ficar negativo.
        self.assertEqual(self.escassa.stock, 0)

    def test_esvazia_o_carrinho(self):
        self.adicionar(quantidade=2)
        self.client.post(reverse("encomendas:checkout"), self.DADOS)

        from .models import ItemCarrinho

        self.assertEqual(ItemCarrinho.objects.count(), 0)


class CicloDeVidaTests(BaseLoja):
    def _encomenda(self, quantidade=3):
        self.adicionar(quantidade=quantidade)
        self.client.post(reverse("encomendas:checkout"), CheckoutTests.DADOS)
        from .models import Encomenda

        return Encomenda.objects.first()

    def test_cancelar_repoe_stock(self):
        encomenda = self._encomenda(3)
        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 7)

        mudar_estado(encomenda, EstadoEncomenda.CANCELADA)

        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 10)

    def test_nao_repoe_duas_vezes(self):
        encomenda = self._encomenda(3)
        mudar_estado(encomenda, EstadoEncomenda.CANCELADA)
        mudar_estado(encomenda, EstadoEncomenda.CANCELADA)

        self.variante.refresh_from_db()
        self.assertEqual(self.variante.stock, 10)

    def test_transicao_invalida_e_recusada(self):
        encomenda = self._encomenda(1)
        with self.assertRaises(ErroDeNegocio):
            mudar_estado(encomenda, EstadoEncomenda.ENTREGUE)

    def test_regista_historico(self):
        encomenda = self._encomenda(1)
        mudar_estado(encomenda, EstadoEncomenda.CONFIRMADA)
        mudar_estado(encomenda, EstadoEncomenda.EM_PREPARACAO)
        # Criação + duas transições.
        self.assertEqual(encomenda.eventos.count(), 3)


class PrevisaoDeEntregaTests(TestCase):
    """
    A loja está em Luanda: dar o mesmo prazo a Luanda e ao Namibe seria
    prometer o que não se cumpre.
    """

    def test_luanda_e_mais_rapida(self):
        from .services import previsao_de_entrega

        luanda = previsao_de_entrega("Luanda")
        namibe = previsao_de_entrega("Namibe")
        self.assertLess(luanda["maximo"], namibe["minimo"])

    def test_provincia_desconhecida_usa_o_prazo_padrao(self):
        from .services import PRAZO_PADRAO, previsao_de_entrega

        previsao = previsao_de_entrega("Terra do Nunca")
        self.assertEqual((previsao["minimo"], previsao["maximo"]), PRAZO_PADRAO)

    def test_texto_legivel(self):
        from .services import previsao_de_entrega

        self.assertEqual(previsao_de_entrega("Luanda")["texto"], "1–3 dias úteis")

    def test_sem_data_de_partida_nao_inventa_datas(self):
        from .services import previsao_de_entrega

        previsao = previsao_de_entrega("Luanda")
        self.assertIsNone(previsao["de"])
        self.assertIsNone(previsao["ate"])

    def test_salta_fins_de_semana(self):
        from .services import previsao_de_entrega

        # Sexta-feira, 7 de Agosto de 2026.
        sexta = timezone.datetime(2026, 8, 7, 10, 0, tzinfo=timezone.get_current_timezone())
        previsao = previsao_de_entrega("Luanda", desde=sexta)
        # Um dia útil depois de sexta é segunda, não sábado.
        self.assertEqual(previsao["de"].weekday(), 0)


class LinhaDoTempoTests(BaseLoja):
    def _encomenda(self):
        self.adicionar(quantidade=1)
        self.client.post(reverse("encomendas:checkout"), CheckoutTests.DADOS)
        from .models import Encomenda

        return Encomenda.objects.first()

    def test_mostra_o_percurso_completo(self):
        encomenda = self._encomenda()
        linha = encomenda.linha_do_tempo
        self.assertEqual(len(linha), 5)
        self.assertEqual(linha[0]["estado"], EstadoEncomenda.NOVA)
        self.assertEqual(linha[-1]["estado"], EstadoEncomenda.ENTREGUE)

    def test_passos_futuros_ficam_sem_data(self):
        encomenda = self._encomenda()
        por_cumprir = [p for p in encomenda.linha_do_tempo if not p["concluido"]]
        self.assertTrue(por_cumprir)
        # Uma data futura inventada seria uma promessa que a loja não controla.
        for passo in por_cumprir:
            self.assertIsNone(passo["quando"])

    def test_marca_o_estado_actual(self):
        encomenda = self._encomenda()
        actuais = [p for p in encomenda.linha_do_tempo if p["actual"]]
        self.assertEqual(len(actuais), 1)
        self.assertEqual(actuais[0]["estado"], EstadoEncomenda.NOVA)

    def test_cancelada_termina_no_cancelamento(self):
        encomenda = self._encomenda()
        mudar_estado(encomenda, EstadoEncomenda.CANCELADA)
        encomenda.refresh_from_db()

        linha = encomenda.linha_do_tempo
        self.assertEqual(linha[-1]["estado"], EstadoEncomenda.CANCELADA)
        # Não anuncia "Entregue" numa encomenda que foi cancelada.
        self.assertNotIn(EstadoEncomenda.ENTREGUE, [p["estado"] for p in linha])

    def test_entregue_nao_mostra_previsao(self):
        encomenda = self._encomenda()
        for estado in ("CONFIRMADA", "EM_PREPARACAO", "ENVIADA", "ENTREGUE"):
            mudar_estado(encomenda, estado)
            encomenda.refresh_from_db()
        self.assertIsNone(encomenda.previsao_entrega)

    def test_aparece_no_detalhe_da_encomenda(self):
        encomenda = self._encomenda()
        utilizador = Utilizador.objects.create_user(
            email="dono@teste.ao", password="Password1", primeiro_nome="A", apelido="B"
        )
        encomenda.utilizador = utilizador
        encomenda.save(update_fields=["utilizador"])

        self.client.login(username="dono@teste.ao", password="Password1")
        resposta = self.client.get(reverse("encomendas:detalhe", args=[encomenda.referencia]))
        self.assertContains(resposta, "Acompanhamento")
        self.assertContains(resposta, "Entrega prevista")


class AcessoTests(BaseLoja):
    def test_painel_exige_administrador(self):
        resposta = self.client.get(reverse("painel:dashboard"))
        self.assertEqual(resposta.status_code, 302)

        Utilizador.objects.create_user(
            email="cliente@teste.ao", password="Password1", primeiro_nome="A", apelido="B"
        )
        self.client.login(username="cliente@teste.ao", password="Password1")
        self.assertEqual(self.client.get(reverse("painel:dashboard")).status_code, 302)

    def test_administrador_entra(self):
        Utilizador.objects.create_user(
            email="admin@teste.ao", password="Password1", primeiro_nome="A",
            apelido="B", papel=Utilizador.Papel.ADMIN,
        )
        self.client.login(username="admin@teste.ao", password="Password1")
        self.assertEqual(self.client.get(reverse("painel:dashboard")).status_code, 200)

    def test_carrinho_nao_e_partilhado_entre_sessoes(self):
        self.adicionar(quantidade=2)
        outro = self.client_class()
        resposta = outro.get(reverse("encomendas:carrinho"))
        self.assertContains(resposta, "O carrinho está vazio")
