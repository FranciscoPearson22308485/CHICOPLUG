from django.urls import path

from . import views

app_name = "catalogo"

urlpatterns = [
    path("", views.home, name="home"),
    path("shop/", views.shop, name="shop"),
    path("produto/<slug:slug>/", views.produto, name="produto"),
    path("produto/<slug:slug>/avaliar/", views.avaliar, name="avaliar"),
    path("marcas/", views.marcas, name="marcas"),
    path("marcas/<slug:slug>/", views.marca, name="marca"),
    path("pesquisa/sugestoes/", views.sugestoes, name="sugestoes"),
    path("newsletter/subscrever/", views.subscrever, name="subscrever"),
    path("sobre/", views.sobre, name="sobre"),
    path("contacto/", views.contacto, name="contacto"),
    path("faq/", views.faq, name="faq"),
    path("termos/", views.legal, {"pagina": "termos"}, name="termos"),
    path("politica-de-privacidade/", views.legal, {"pagina": "privacidade"}, name="privacidade"),
    path("politica-de-trocas/", views.legal, {"pagina": "trocas"}, name="trocas"),
]
