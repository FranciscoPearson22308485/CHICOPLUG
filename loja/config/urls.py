from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path

urlpatterns = [
    path("", include("catalogo.urls")),
    path("conta/", include("contas.urls")),
    path("", include("encomendas.urls")),
    path("painel/", include("painel.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
