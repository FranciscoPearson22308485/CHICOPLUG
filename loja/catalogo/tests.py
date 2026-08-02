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


class PaginasSemArtefactosTests(TestCase):
    """
    Percorre as páginas públicas e garante que nada de sintaxe de template
    chega ao HTML servido.
    """

    URLS = [
        "/", "/shop/", "/marcas/", "/sobre/", "/contacto/", "/faq/",
        "/termos/", "/politica-de-privacidade/", "/politica-de-trocas/",
        "/carrinho/", "/conta/entrar/", "/conta/registar/",
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
