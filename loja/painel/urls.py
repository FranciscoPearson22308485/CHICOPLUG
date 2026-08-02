from django.urls import path

from . import views

app_name = "painel"

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("produtos/", views.produtos, name="produtos"),
    path("marcas/", views.marcas, name="marcas"),
    path("categorias/", views.categorias, name="categorias"),
    path("encomendas/", views.encomendas, name="encomendas"),
    path("stock/", views.stock, name="stock"),
    path("definicoes/", views.definicoes, name="definicoes"),
]
