"""
Testes de integridade dos templates e do front-end.

    python manage.py test catalogo

Estes testes existem por causa de dois bugs reais que chegaram ao ecrã:

1. `{# … #}` escrito em várias linhas. O lexer do Django só reconhece este
   comentário dentro de uma linha, por isso o texto saía literal para dentro
   do <head> e o browser empurrava-o para o topo da página.

2. `class="hidden … md:block"` num elemento cuja visibilidade é controlada por
   JavaScript. No CSS compilado do Tailwind, `.md\\:block` vem depois de
   `.hidden`, logo ganha na cascata e o `classList.toggle("hidden")` do JS
   deixa de ter qualquer efeito.

Ambos passam despercebidos a testes de view — a página devolve 200 na mesma.
"""

import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from django.conf import settings
from django.template import TemplateSyntaxError
from django.template.loader import get_template
from django.test import TestCase
from django.urls import reverse

DIRECTORIO_TEMPLATES = Path(settings.BASE_DIR) / "templates"
TAILWIND = Path(settings.BASE_DIR) / "node_modules" / ".bin" / "tailwindcss"
CSS_COMPILADO = Path(settings.BASE_DIR) / "static" / "css" / "loja.css"


def _templates():
    """Todos os templates do projecto, como caminhos relativos ao carregador."""
    return sorted(
        caminho.relative_to(DIRECTORIO_TEMPLATES).as_posix()
        for caminho in DIRECTORIO_TEMPLATES.rglob("*.html")
    )


class ComentariosTemplateTests(TestCase):
    def test_nenhum_comentario_curto_atravessa_linhas(self):
        """
        `{# … #}` tem de abrir e fechar na mesma linha.

        Para comentários de várias linhas existe {% comment %}…{% endcomment %}.
        """
        infractores = []
        for nome in _templates():
            for numero, linha in enumerate((DIRECTORIO_TEMPLATES / nome).read_text().splitlines(), 1):
                # Conta as aberturas sem fecho na mesma linha.
                if linha.count("{#") > linha.count("#}"):
                    infractores.append(f"{nome}:{numero}")

        self.assertEqual(
            infractores, [],
            "Comentário {# #} a atravessar linhas (sai como texto visível na "
            "página). Usa {% comment %}…{% endcomment %}:\n  " + "\n  ".join(infractores),
        )

    def test_todos_os_templates_compilam(self):
        erros = []
        for nome in _templates():
            try:
                get_template(nome)
            except TemplateSyntaxError as erro:
                erros.append(f"{nome}: {erro}")
        self.assertEqual(erros, [], "Templates com erro de sintaxe:\n  " + "\n  ".join(erros))


class VisibilidadeControladaPorJsTests(TestCase):
    """
    Elementos que o JavaScript mostra/esconde não podem ter utilitários de
    display por breakpoint: no CSS compilado essas classes vencem `.hidden`,
    e o toggle do JS passa a não ter efeito nenhum.
    """

    # Alternados em static/js/loja.js via classList.toggle/add/remove("hidden").
    SELECTORES_ALTERNADOS_POR_JS = [
        "data-mega-menu",
        "data-painel-pesquisa",
        "data-menu-mobile",
        "data-sugestoes",
    ]

    DISPLAY_POR_BREAKPOINT = re.compile(
        r"\b(?:sm|md|lg|xl|2xl):(?:block|flex|grid|inline|inline-block|inline-flex|table)\b"
    )

    def test_sem_display_por_breakpoint(self):
        problemas = []
        for nome in _templates():
            texto = (DIRECTORIO_TEMPLATES / nome).read_text()
            for atributo in self.SELECTORES_ALTERNADOS_POR_JS:
                for tag in re.findall(rf"<[^>]*\b{atributo}\b[^>]*>", texto):
                    encontrado = self.DISPLAY_POR_BREAKPOINT.findall(tag)
                    if encontrado:
                        problemas.append(f"{nome}: [{atributo}] tem {', '.join(encontrado)}")

        self.assertEqual(
            problemas, [],
            "Elemento controlado por JS com display por breakpoint — o toggle "
            "de `hidden` deixa de funcionar:\n  " + "\n  ".join(problemas),
        )


@unittest.skipUnless(TAILWIND.exists(), "Tailwind não instalado (npm install).")
class CssCompiladoTests(unittest.TestCase):
    """
    O Tailwind 4 só gera as classes que encontra nos templates. Acrescentar um
    ecrã novo sem recompilar deixa-o parcialmente sem estilo — e a página
    continua a devolver 200, por isso nenhum teste de view daria por isso.

    Recompila para um ficheiro temporário e compara com o que está commitado.
    """

    def test_esta_actualizado(self):
        with tempfile.TemporaryDirectory() as pasta:
            recem_compilado = Path(pasta) / "loja.css"
            resultado = subprocess.run(
                [str(TAILWIND), "-i", "assets/css/entrada.css", "-o", str(recem_compilado)],
                cwd=settings.BASE_DIR, capture_output=True, text=True,
            )
            self.assertEqual(resultado.returncode, 0, f"Falhou a compilar o CSS:\n{resultado.stderr}")

            self.assertEqual(
                recem_compilado.read_text(), CSS_COMPILADO.read_text(),
                "static/css/loja.css está desactualizado face aos templates. Corre:  npm run css",
            )


class BaseAvaliacoes(TestCase):
    """Um cliente que comprou, outro que não, e uma peça para avaliar."""

    def setUp(self):
        from catalogo.models import Categoria, Marca, Produto, Variante
        from contas.models import Utilizador
        from encomendas.models import Encomenda, EstadoEncomenda, ItemEncomenda

        self.marca = Marca.objects.create(nome="Marca Teste")
        self.categoria = Categoria.objects.create(nome="Hoodies")
        self.produto = Produto.objects.create(
            nome="Hoodie Teste", descricao="Teste", preco=50000,
            marca=self.marca, categoria=self.categoria,
        )
        self.variante = Variante.objects.create(
            produto=self.produto, tamanho="M", cor_nome="Preto", sku="CP-A-0001", stock=5,
        )

        self.comprador = Utilizador.objects.create_user(
            email="comprou@teste.ao", password="Password1", primeiro_nome="Ana", apelido="Miguel"
        )
        self.curioso = Utilizador.objects.create_user(
            email="nao@teste.ao", password="Password1", primeiro_nome="Rui", apelido="Costa"
        )

        encomenda = Encomenda.objects.create(
            referencia="CP-5001", utilizador=self.comprador, nome_cliente="Ana Miguel",
            email="comprou@teste.ao", telefone="+244900000000",
            estado=EstadoEncomenda.ENTREGUE, subtotal=50000, total=50000,
            provincia="Luanda", municipio="Talatona", rua="Rua Teste",
        )
        ItemEncomenda.objects.create(
            encomenda=encomenda, variante=self.variante, marca="Marca Teste",
            nome_produto="Hoodie Teste", slug_produto=self.produto.slug,
            tamanho="M", cor_nome="Preto", sku="CP-A-0001",
            preco_unitario=50000, quantidade=1, total_linha=50000,
        )
        self.encomenda = encomenda


class PermissaoParaAvaliarTests(BaseAvaliacoes):
    def test_quem_comprou_pode(self):
        from catalogo import services

        self.assertTrue(services.pode_avaliar(self.comprador, self.produto))

    def test_quem_nao_comprou_nao_pode(self):
        from catalogo import services

        self.assertFalse(services.pode_avaliar(self.curioso, self.produto))

    def test_anonimo_nao_pode(self):
        from django.contrib.auth.models import AnonymousUser

        from catalogo import services

        self.assertFalse(services.pode_avaliar(AnonymousUser(), self.produto))

    def test_encomenda_por_pagar_nao_conta(self):
        """Uma encomenda ainda NOVA não é uma compra — não foi paga."""
        from catalogo import services
        from encomendas.models import EstadoEncomenda

        self.encomenda.estado = EstadoEncomenda.NOVA
        self.encomenda.save(update_fields=["estado"])
        self.assertFalse(services.pode_avaliar(self.comprador, self.produto))

    def test_encomenda_cancelada_nao_conta(self):
        from catalogo import services
        from encomendas.models import EstadoEncomenda

        self.encomenda.estado = EstadoEncomenda.CANCELADA
        self.encomenda.save(update_fields=["estado"])
        self.assertFalse(services.pode_avaliar(self.comprador, self.produto))

    def test_variante_removida_nao_apaga_a_prova(self):
        """O instantâneo da linha sobrevive à remoção da variante do catálogo."""
        from catalogo import services

        self.variante.delete()
        self.assertTrue(services.pode_avaliar(self.comprador, self.produto))


class CriarAvaliacaoTests(BaseAvaliacoes):
    def test_cria_com_compra_verificada(self):
        from catalogo import services

        a = services.criar_avaliacao(self.comprador, self.produto, 5, "Excelente.")
        self.assertEqual(a.estrelas, 5)
        self.assertTrue(a.compra_verificada)
        self.assertTrue(a.publicada)

    def test_recusa_quem_nao_comprou(self):
        from catalogo import services
        from encomendas.services import ErroDeNegocio

        with self.assertRaises(ErroDeNegocio):
            services.criar_avaliacao(self.curioso, self.produto, 5)

    def test_recusa_segunda_avaliacao(self):
        from catalogo import services
        from encomendas.services import ErroDeNegocio

        services.criar_avaliacao(self.comprador, self.produto, 4)
        with self.assertRaises(ErroDeNegocio):
            services.criar_avaliacao(self.comprador, self.produto, 1)

    def test_recusa_classificacao_fora_do_intervalo(self):
        from catalogo import services
        from encomendas.services import ErroDeNegocio

        for valor in (0, 6, -1, "abc", None):
            with self.subTest(valor=valor):
                with self.assertRaises(ErroDeNegocio):
                    services.criar_avaliacao(self.comprador, self.produto, valor)


class ResumoDeAvaliacoesTests(BaseAvaliacoes):
    def _avaliar(self, utilizador, estrelas):
        from catalogo.models import Avaliacao

        return Avaliacao.objects.create(produto=self.produto, utilizador=utilizador, estrelas=estrelas)

    def test_sem_avaliacoes_a_media_e_none(self):
        # 0,0 leria como péssima; ausência de dados não é uma nota baixa.
        self.assertIsNone(self.produto.media_avaliacoes)
        self.assertEqual(self.produto.total_avaliacoes, 0)

    def test_media_e_total(self):
        self._avaliar(self.comprador, 5)
        self._avaliar(self.curioso, 4)
        self.produto.refresh_from_db()
        self.assertEqual(self.produto.media_avaliacoes, 4.5)
        self.assertEqual(self.produto.total_avaliacoes, 2)

    def test_escondida_nao_conta_para_a_media(self):
        self._avaliar(self.comprador, 5)
        escondida = self._avaliar(self.curioso, 1)
        escondida.publicada = False
        escondida.save(update_fields=["publicada"])

        self.produto.refresh_from_db()
        self.assertEqual(self.produto.media_avaliacoes, 5.0)
        self.assertEqual(self.produto.total_avaliacoes, 1)

    def test_distribuicao_em_percentagem(self):
        self._avaliar(self.comprador, 5)
        self._avaliar(self.curioso, 5)
        self.produto.refresh_from_db()

        por_estrelas = {l["estrelas"]: l for l in self.produto.distribuicao_avaliacoes}
        self.assertEqual(por_estrelas[5]["total"], 2)
        self.assertEqual(por_estrelas[5]["percentagem"], 100)
        self.assertEqual(por_estrelas[1]["percentagem"], 0)


class AvaliacoesNaLojaTests(BaseAvaliacoes):
    def test_formulario_so_aparece_a_quem_comprou(self):
        url = self.produto.get_absolute_url()

        self.client.login(username="comprou@teste.ao", password="Password1")
        self.assertContains(self.client.get(url), "Publicar avaliação")

        self.client.logout()
        self.client.login(username="nao@teste.ao", password="Password1")
        self.assertNotContains(self.client.get(url), "Publicar avaliação")

    def test_publicar_pela_loja(self):
        from catalogo.models import Avaliacao

        self.client.login(username="comprou@teste.ao", password="Password1")
        resposta = self.client.post(
            reverse("catalogo:avaliar", args=[self.produto.slug]),
            {"estrelas": "5", "comentario": "Serve na perfeição."},
        )
        self.assertEqual(resposta.status_code, 302)
        self.assertTrue(Avaliacao.objects.filter(produto=self.produto, estrelas=5).exists())

    def test_quem_nao_comprou_nao_consegue_publicar(self):
        from catalogo.models import Avaliacao

        self.client.login(username="nao@teste.ao", password="Password1")
        self.client.post(
            reverse("catalogo:avaliar", args=[self.produto.slug]),
            {"estrelas": "5", "comentario": "Nunca comprei isto."},
        )
        self.assertEqual(Avaliacao.objects.count(), 0)

    def test_anonimo_e_enviado_para_o_login(self):
        resposta = self.client.post(
            reverse("catalogo:avaliar", args=[self.produto.slug]), {"estrelas": "5"}
        )
        self.assertEqual(resposta.status_code, 302)
        self.assertIn("/conta/entrar/", resposta["Location"])

    def test_media_aparece_na_ficha(self):
        from catalogo.models import Avaliacao

        Avaliacao.objects.create(produto=self.produto, utilizador=self.comprador, estrelas=4)
        resposta = self.client.get(self.produto.get_absolute_url())
        self.assertContains(resposta, "Compra verificada")
        self.assertContains(resposta, "4.0")


class GaleriaDeClientesTests(BaseAvaliacoes):
    """
    A galeria é a vista agregada das fotografias das avaliações — não há um
    segundo sistema de upload nem uma segunda moderação.
    """

    def _com_foto(self, utilizador, estrelas=5):
        from catalogo.models import Avaliacao, FotoAvaliacao

        avaliacao = Avaliacao.objects.create(
            produto=self.produto, utilizador=utilizador, estrelas=estrelas
        )
        FotoAvaliacao.objects.create(
            avaliacao=avaliacao, url_externa="https://exemplo.test/foto.jpg"
        )
        return avaliacao

    def test_vazia_sem_fotografias(self):
        from catalogo import services

        self.assertEqual(services.galeria_de_clientes(), [])

    def test_mostra_fotografia_publicada(self):
        from catalogo import services

        self._com_foto(self.comprador)
        fotos = services.galeria_de_clientes()
        self.assertEqual(len(fotos), 1)
        self.assertEqual(fotos[0].avaliacao.produto, self.produto)

    def test_esconder_avaliacao_retira_da_galeria(self):
        from catalogo import services

        avaliacao = self._com_foto(self.comprador)
        avaliacao.publicada = False
        avaliacao.save(update_fields=["publicada"])

        self.assertEqual(services.galeria_de_clientes(), [])

    def test_cidade_vem_da_encomenda_do_cliente(self):
        from catalogo import services

        self._com_foto(self.comprador)
        # A encomenda criada em setUp é de Talatona.
        self.assertEqual(services.galeria_de_clientes()[0].cidade, "Talatona")

    def test_cliente_sem_encomenda_fica_sem_cidade(self):
        from catalogo import services

        self._com_foto(self.curioso)
        self.assertEqual(services.galeria_de_clientes()[0].cidade, "")

    def test_pagina_abre(self):
        resposta = self.client.get(reverse("catalogo:galeria"))
        self.assertEqual(resposta.status_code, 200)
        self.assertContains(resposta, "Ainda não há fotografias")

    def test_pagina_mostra_a_fotografia(self):
        self._com_foto(self.comprador)
        resposta = self.client.get(reverse("catalogo:galeria"))
        self.assertContains(resposta, "https://exemplo.test/foto.jpg")
        self.assertContains(resposta, "Talatona")


class PartilhaTests(BaseAvaliacoes):
    def test_botoes_apontam_para_a_peca(self):
        from django.conf import settings

        resposta = self.client.get(self.produto.get_absolute_url())
        corpo = resposta.content.decode()

        # O endereço partilhado tem de ser absoluto: um caminho relativo
        # partilhado no WhatsApp não abre em lado nenhum.
        self.assertIn(settings.SITE_URL, corpo)
        for destino in ("wa.me", "facebook.com/sharer", "t.me/share", "twitter.com/intent"):
            with self.subTest(destino):
                self.assertIn(destino, corpo)

    def test_botao_de_copiar_existe(self):
        resposta = self.client.get(self.produto.get_absolute_url())
        self.assertContains(resposta, "data-copiar-ligacao")

    def test_partilha_nativa_comeca_escondida(self):
        """Só o JavaScript a mostra, e apenas onde `navigator.share` existe."""
        resposta = self.client.get(self.produto.get_absolute_url())
        self.assertContains(resposta, "data-partilha-nativa hidden")


class PromocoesENovidadesTests(BaseAvaliacoes):
    """
    As três listagens partilham a mesma view e o mesmo template; o que muda é
    o conjunto de partida. Estes testes fixam essa diferença.
    """

    def setUp(self):
        super().setUp()
        from catalogo.models import Produto, Variante

        # Uma peça com preço anterior (em promoção) e outra sem.
        self.em_promocao = Produto.objects.create(
            nome="Casaco Saldos", descricao="Teste", preco=40000, preco_anterior=60000,
            marca=self.marca, categoria=self.categoria,
        )
        Variante.objects.create(
            produto=self.em_promocao, tamanho="M", cor_nome="Preto", sku="CP-P-0001", stock=3,
        )

    def test_promocoes_mostra_so_quem_tem_desconto(self):
        resposta = self.client.get(reverse("catalogo:promocoes"))
        self.assertEqual(resposta.status_code, 200)
        self.assertContains(resposta, "Casaco Saldos")
        self.assertNotContains(resposta, "Hoodie Teste")

    def test_promocoes_tem_titulo_proprio(self):
        resposta = self.client.get(reverse("catalogo:promocoes"))
        self.assertContains(resposta, "Promoções")
        self.assertContains(resposta, "Preços reduzidos")

    def test_novidades_mostra_tudo_por_data(self):
        resposta = self.client.get(reverse("catalogo:novidades"))
        self.assertEqual(resposta.status_code, 200)
        # A mais recente foi criada em setUp depois da outra.
        corpo = resposta.content.decode()
        self.assertLess(corpo.index("Casaco Saldos"), corpo.index("Hoodie Teste"))

    def test_shop_continua_a_mostrar_tudo(self):
        """A parametrização não pode ter alterado o comportamento do Shop."""
        resposta = self.client.get(reverse("catalogo:shop"))
        self.assertContains(resposta, "Casaco Saldos")
        self.assertContains(resposta, "Hoodie Teste")
        self.assertContains(resposta, "Shop")

    def test_filtros_continuam_a_funcionar_nas_paginas_novas(self):
        resposta = self.client.get(reverse("catalogo:promocoes"), {"ordenar": "preco-asc"})
        self.assertEqual(resposta.status_code, 200)
        self.assertContains(resposta, "Casaco Saldos")


class HistoricoDePrecosTests(BaseAvaliacoes):
    """
    O histórico é escrito pelo próprio `Produto.save()`: não depende de quem
    edita se lembrar de o registar, nem de passar pelo painel.
    """

    def test_nao_regista_na_criacao(self):
        from catalogo.models import HistoricoPreco, Produto

        Produto.objects.create(
            nome="Peça Nova", descricao="x", preco=30000,
            marca=self.marca, categoria=self.categoria,
        )
        self.assertEqual(HistoricoPreco.objects.count(), 0)

    def test_regista_a_descida(self):
        from catalogo.models import HistoricoPreco

        self.produto.preco = 40000
        self.produto.save()

        registo = HistoricoPreco.objects.get()
        self.assertEqual(registo.preco_anterior, 50000)
        self.assertEqual(registo.preco_novo, 40000)
        self.assertTrue(registo.desceu)
        self.assertEqual(registo.variacao, 10000)
        self.assertEqual(registo.percentagem, 20)

    def test_regista_a_subida(self):
        from catalogo.models import HistoricoPreco

        self.produto.preco = 60000
        self.produto.save()
        self.assertFalse(HistoricoPreco.objects.get().desceu)

    def test_nao_regista_quando_o_preco_nao_muda(self):
        from catalogo.models import HistoricoPreco

        self.produto.nome = "Outro Nome"
        self.produto.save()
        self.assertEqual(HistoricoPreco.objects.count(), 0)

    def test_guarda_cada_alteracao(self):
        from catalogo.models import HistoricoPreco

        for novo in (45000, 42000, 39000):
            self.produto.preco = novo
            self.produto.save()

        self.assertEqual(HistoricoPreco.objects.count(), 3)
        # Ordenação decrescente: o mais recente primeiro.
        self.assertEqual(self.produto.ultima_alteracao_de_preco.preco_novo, 39000)

    def test_valor_poupado(self):
        from catalogo.models import Produto

        peca = Produto.objects.create(
            nome="Com Desconto", descricao="x", preco=40000, preco_anterior=60000,
            marca=self.marca, categoria=self.categoria,
        )
        self.assertEqual(peca.valor_poupado, 20000)
        self.assertEqual(peca.percentagem_desconto, 33)

    def test_sem_desconto_nao_ha_valor_poupado(self):
        self.assertIsNone(self.produto.valor_poupado)

    def test_preco_anterior_mais_baixo_nao_conta_como_poupanca(self):
        """Um "preço anterior" inferior ao actual não é desconto nenhum."""
        from catalogo.models import Produto

        peca = Produto.objects.create(
            nome="Subiu", descricao="x", preco=60000, preco_anterior=40000,
            marca=self.marca, categoria=self.categoria,
        )
        self.assertIsNone(peca.valor_poupado)

    def test_poupanca_aparece_na_ficha(self):
        from catalogo.models import Produto, Variante

        peca = Produto.objects.create(
            nome="Com Desconto", descricao="x", preco=40000, preco_anterior=60000,
            marca=self.marca, categoria=self.categoria,
        )
        Variante.objects.create(
            produto=peca, tamanho="M", cor_nome="Preto", sku="CP-D-0001", stock=2
        )
        resposta = self.client.get(peca.get_absolute_url())
        self.assertContains(resposta, "Poupas")


class AlertaDeReposicaoTests(BaseAvaliacoes):
    def setUp(self):
        super().setUp()
        from catalogo.models import Variante

        Variante.objects.filter(produto=self.produto).update(stock=0)
        self.produto.refresh_from_db()

    def test_registar(self):
        from catalogo import services
        from catalogo.models import AlertaReposicao

        services.registar_alerta(self.produto, "Ana", "ana@teste.ao", "+244900000000")
        alerta = AlertaReposicao.objects.get()
        self.assertTrue(alerta.pendente)
        self.assertEqual(alerta.email, "ana@teste.ao")

    def test_nao_duplica_a_mesma_inscricao(self):
        from catalogo import services
        from catalogo.models import AlertaReposicao

        services.registar_alerta(self.produto, "Ana", "ana@teste.ao")
        services.registar_alerta(self.produto, "Ana", "ANA@teste.ao")
        # Quem carrega duas vezes no botão não deve receber dois avisos.
        self.assertEqual(AlertaReposicao.objects.count(), 1)

    def test_recusa_email_invalido(self):
        from catalogo import services
        from encomendas.services import ErroDeNegocio

        with self.assertRaises(ErroDeNegocio):
            services.registar_alerta(self.produto, "Ana", "isto-nao-e-email")

    def test_formulario_so_aparece_quando_esgotado(self):
        resposta = self.client.get(self.produto.get_absolute_url())
        self.assertContains(resposta, "Avise-me quando voltar")

        from catalogo.models import Variante

        Variante.objects.filter(produto=self.produto).update(stock=5)
        resposta = self.client.get(self.produto.get_absolute_url())
        self.assertNotContains(resposta, "Avise-me quando voltar")

    def test_inscricao_pela_loja_sem_conta(self):
        from catalogo.models import AlertaReposicao

        resposta = self.client.post(
            reverse("catalogo:avisar_reposicao", args=[self.produto.slug]),
            {"nome": "Rui", "email": "rui@teste.ao", "telefone": "+244911111111"},
        )
        self.assertEqual(resposta.status_code, 302)
        self.assertEqual(AlertaReposicao.objects.count(), 1)

    def test_notifica_e_marca_como_tratado(self):
        from catalogo import services
        from catalogo.models import AlertaReposicao, Variante

        services.registar_alerta(self.produto, "Ana", "ana@teste.ao")
        Variante.objects.filter(produto=self.produto).update(stock=4)
        self.produto.refresh_from_db()

        self.assertEqual(services.notificar_reposicoes(self.produto), 1)
        self.assertFalse(AlertaReposicao.objects.get().pendente)

    def test_nao_notifica_duas_vezes(self):
        from catalogo import services
        from catalogo.models import Variante

        services.registar_alerta(self.produto, "Ana", "ana@teste.ao")
        Variante.objects.filter(produto=self.produto).update(stock=4)
        self.produto.refresh_from_db()

        services.notificar_reposicoes(self.produto)
        self.assertEqual(services.notificar_reposicoes(self.produto), 0)

    def test_nao_notifica_sem_stock(self):
        from catalogo import services

        services.registar_alerta(self.produto, "Ana", "ana@teste.ao")
        # Continua esgotado: avisar agora seria mandar as pessoas a uma página
        # onde não podem comprar.
        self.assertEqual(services.notificar_reposicoes(self.produto), 0)

    def test_envia_email(self):
        from django.core import mail

        from catalogo import services
        from catalogo.models import Variante

        services.registar_alerta(self.produto, "Ana", "ana@teste.ao")
        Variante.objects.filter(produto=self.produto).update(stock=4)
        self.produto.refresh_from_db()
        services.notificar_reposicoes(self.produto)

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("voltou ao stock", mail.outbox[0].subject)
        self.assertEqual(mail.outbox[0].to, ["ana@teste.ao"])

    def test_sms_por_configurar_nao_rebenta(self):
        from catalogo.notificacoes import enviar_sms, estado_sms

        # Sem credenciais o adaptador regista e devolve False, em vez de falhar.
        self.assertFalse(enviar_sms("+244900000000", "teste"))
        self.assertFalse(estado_sms()["configurado"])


class PaginasSemArtefactosTests(TestCase):
    """
    Percorre as páginas públicas e garante que nada de sintaxe de template
    chega ao HTML servido.
    """

    URLS = [
        "/", "/shop/", "/marcas/", "/sobre/", "/contacto/", "/faq/",
        "/termos/", "/politica-de-privacidade/", "/politica-de-trocas/",
        "/carrinho/", "/conta/entrar/", "/conta/registar/", "/galeria/",
        "/promocoes/", "/novidades/",
    ]

    def test_sem_sintaxe_de_template_visivel(self):
        problemas = []
        for url in self.URLS:
            resposta = self.client.get(url)
            self.assertEqual(resposta.status_code, 200, f"{url} devolveu {resposta.status_code}")

            corpo = resposta.content.decode("utf-8", errors="replace")
            for marca in ("{#", "#}", "{%", "{{"):
                if marca in corpo:
                    posicao = corpo.index(marca)
                    problemas.append(f"{url}: {marca!r} em …{corpo[posicao - 60:posicao + 60]!r}")

        self.assertEqual(problemas, [], "Sintaxe de template visível no HTML:\n  " + "\n  ".join(problemas))
