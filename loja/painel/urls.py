from django.urls import path

from . import views

app_name = "painel"

urlpatterns = [
    path("", views.dashboard, name="dashboard"),

    path("produtos/", views.produtos, name="produtos"),
    path("produtos/novo/", views.produto_novo, name="produto_novo"),
    path("produtos/<int:pk>/editar/", views.produto_editar, name="produto_editar"),
    path("produtos/<int:pk>/remover/", views.produto_remover, name="produto_remover"),
    path("produtos/exportar.csv", views.produtos_exportar, name="produtos_exportar"),

    path("marcas/", views.marcas, name="marcas"),
    path("marcas/nova/", views.marca_nova, name="marca_nova"),
    path("marcas/<int:pk>/editar/", views.marca_editar, name="marca_editar"),
    path("marcas/<int:pk>/remover/", views.marca_remover, name="marca_remover"),

    path("categorias/", views.categorias, name="categorias"),
    path("categorias/nova/", views.categoria_nova, name="categoria_nova"),
    path("categorias/<int:pk>/editar/", views.categoria_editar, name="categoria_editar"),
    path("categorias/<int:pk>/remover/", views.categoria_remover, name="categoria_remover"),

    path("cupoes/", views.cupoes, name="cupoes"),
    path("cupoes/novo/", views.cupao_novo, name="cupao_novo"),
    path("cupoes/<int:pk>/editar/", views.cupao_editar, name="cupao_editar"),
    path("cupoes/<int:pk>/remover/", views.cupao_remover, name="cupao_remover"),

    path("avaliacoes/", views.avaliacoes, name="avaliacoes"),
    path("avaliacoes/<int:pk>/alternar/", views.avaliacao_alternar, name="avaliacao_alternar"),
    path("avaliacoes/<int:pk>/remover/", views.avaliacao_remover, name="avaliacao_remover"),

    path("encomendas/", views.encomendas, name="encomendas"),
    path("encomendas/<str:referencia>/estado/", views.encomenda_mudar_estado, name="encomenda_mudar_estado"),
    path("encomendas/exportar.csv", views.encomendas_exportar, name="encomendas_exportar"),

    path("stock/", views.stock, name="stock"),
    path("stock/ajustar/", views.stock_ajustar, name="stock_ajustar"),

    path("definicoes/", views.definicoes, name="definicoes"),
]
