"""
Formulários do painel.

Um único mixin aplica as classes Tailwind a todos os campos, para não repetir
o mesmo widget em cada `Meta.widgets`.
"""

from django import forms

from catalogo.models import Categoria, ImagemProduto, Marca, Produto, Variante
from encomendas.models import Cupao

CLASSE_INPUT = "h-12 w-full border border-border bg-transparent px-4 text-sm outline-none focus:border-foreground"
CLASSE_TEXTAREA = "w-full border border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-foreground"
CLASSE_CHECKBOX = "size-4 border border-border"


class _FormularioBase(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for campo in self.fields.values():
            if isinstance(campo.widget, forms.CheckboxInput):
                campo.widget.attrs.setdefault("class", CLASSE_CHECKBOX)
            elif isinstance(campo.widget, forms.Textarea):
                campo.widget.attrs.setdefault("class", CLASSE_TEXTAREA)
                campo.widget.attrs.setdefault("rows", 4)
            elif isinstance(campo.widget, forms.ClearableFileInput):
                campo.widget.attrs.setdefault("class", "text-sm")
            else:
                campo.widget.attrs.setdefault("class", CLASSE_INPUT)


class MarcaForm(_FormularioBase):
    class Meta:
        model = Marca
        fields = ["nome", "assinatura", "descricao", "imagem", "logotipo", "destaque", "posicao", "activa"]


class CategoriaForm(_FormularioBase):
    class Meta:
        model = Categoria
        fields = ["nome", "descricao", "posicao", "activa"]


class CupaoForm(_FormularioBase):
    class Meta:
        model = Cupao
        fields = [
            "codigo", "tipo", "valor", "subtotal_minimo", "max_utilizacoes",
            "comeca_em", "termina_em", "activo",
        ]
        widgets = {
            "comeca_em": forms.DateTimeInput(attrs={"type": "datetime-local"}, format="%Y-%m-%dT%H:%M"),
            "termina_em": forms.DateTimeInput(attrs={"type": "datetime-local"}, format="%Y-%m-%dT%H:%M"),
        }


class ProdutoForm(_FormularioBase):
    class Meta:
        model = Produto
        fields = [
            "nome", "marca", "categoria", "descricao", "detalhes",
            "preco", "preco_anterior", "distintivo", "novidade", "mais_vendido", "activo",
            "meta_titulo", "meta_descricao",
        ]


class VarianteForm(_FormularioBase):
    class Meta:
        model = Variante
        fields = ["tamanho", "cor_nome", "cor_hex", "sku", "stock", "limiar_stock_baixo", "preco_proprio", "activa"]


class ImagemProdutoForm(_FormularioBase):
    class Meta:
        model = ImagemProduto
        fields = ["ficheiro", "url_externa", "texto_alternativo", "posicao"]


# Geridas dentro da própria página do produto — não faz sentido um ecrã à
# parte para uma variante ou uma imagem sem o produto a que pertencem.
VarianteFormSet = forms.inlineformset_factory(
    Produto, Variante, form=VarianteForm, extra=1, can_delete=True,
)
ImagemFormSet = forms.inlineformset_factory(
    Produto, ImagemProduto, form=ImagemProdutoForm, extra=1, can_delete=True,
)
