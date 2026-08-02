from django.urls import path

from . import views

app_name = "encomendas"

urlpatterns = [
    path("carrinho/", views.carrinho, name="carrinho"),
    path("carrinho/adicionar/", views.adicionar, name="adicionar"),
    path("carrinho/item/<int:item_id>/actualizar/", views.actualizar, name="actualizar"),
    path("carrinho/item/<int:item_id>/remover/", views.remover, name="remover"),
    path("checkout/", views.checkout, name="checkout"),
    path("pagamento/<str:referencia>/", views.pagamento, name="pagamento"),
    path("pagamento/<str:referencia>/estado/", views.estado_pagamento, name="estado_pagamento"),
    path("pagamento/<str:referencia>/simular/", views.simular_pagamento, name="simular_pagamento"),
    path("conta/encomendas/", views.minhas_encomendas, name="minhas"),
    path("conta/encomendas/<str:referencia>/", views.detalhe, name="detalhe"),
    path("conta/encomendas/<str:referencia>/cancelar/", views.cancelar, name="cancelar"),
]
