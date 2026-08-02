from django.contrib.auth import views as auth_views
from django.urls import path

from . import views

app_name = "contas"

urlpatterns = [
    path("entrar/", views.entrar, name="entrar"),
    path("registar/", views.registar, name="registar"),
    path("sair/", views.sair, name="sair"),
    path("", views.perfil, name="perfil"),
    path("password/", views.alterar_password, name="alterar_password"),
    path("favoritos/", views.favoritos, name="favoritos"),
    path("favoritos/alternar/", views.alternar_favorito, name="alternar_favorito"),
    path("moradas/", views.moradas, name="moradas"),
    path("moradas/<int:pk>/remover/", views.remover_morada, name="remover_morada"),
    # Recuperação de password: usamos as vistas do Django, que já tratam de
    # tokens assinados e expiração — reimplementá-las seria só risco.
    path("recuperar/", auth_views.PasswordResetView.as_view(
        template_name="contas/recuperar.html",
        email_template_name="contas/email_recuperacao.txt",
        success_url="/conta/recuperar/enviado/"), name="recuperar"),
    path("recuperar/enviado/", auth_views.PasswordResetDoneView.as_view(
        template_name="contas/recuperar_enviado.html"), name="password_reset_done"),
    path("repor/<uidb64>/<token>/", auth_views.PasswordResetConfirmView.as_view(
        template_name="contas/repor.html", success_url="/conta/entrar/"), name="password_reset_confirm"),
]
