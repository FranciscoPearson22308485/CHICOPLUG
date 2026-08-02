"""
Notificações ao cliente — porta e adaptadores.

Mesmo desenho de `encomendas/pagamentos.py`: a loja chama sempre
`avisar_reposicao`, nunca um fornecedor de SMS directamente. É isso que
permite ter hoje o email a funcionar e ligar o SMS amanhã mudando variáveis de
ambiente, sem tocar nas regras de negócio.

O email usa a configuração de `settings`: sem SMTP definido, o Django escreve
a mensagem na consola em vez de a enviar. É desenvolvimento, não uma falha
silenciosa — a mensagem aparece no terminal.
"""

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


# ─── SMS: porta e adaptadores ─────────────────────────────────────────────────


class SmsNaoConfigurado:
    """
    Adaptador em vigor enquanto não houver credenciais.

    Regista o que teria enviado em vez de falhar: o resto do fluxo não pode
    depender de haver um contrato de SMS assinado.
    """

    nome = "nenhum"

    def configurado(self):
        return False

    def enviar(self, telefone, mensagem):
        logger.info("[SMS por configurar] para %s: %s", telefone, mensagem)
        return False


class SmsGenerico:
    """
    Adaptador HTTP para um agregador de SMS angolano.

    Fica deliberadamente por ligar: sem saber qual o fornecedor contratado nem
    o formato exacto da API, escrever o pedido HTTP seria adivinhar. O que
    falta é só o corpo deste método — a loja já chama por aqui.
    """

    nome = "generico"

    def configurado(self):
        return bool(settings.SMS_API_URL and settings.SMS_API_CHAVE)

    def enviar(self, telefone, mensagem):
        raise NotImplementedError(
            "Adaptador de SMS por implementar: define SMS_PROVEDOR e o pedido "
            "HTTP do fornecedor contratado."
        )


def _adaptador_sms():
    if getattr(settings, "SMS_PROVEDOR", "") == "generico":
        adaptador = SmsGenerico()
        if adaptador.configurado():
            return adaptador
    return SmsNaoConfigurado()


def enviar_sms(telefone, mensagem):
    if not telefone:
        return False
    try:
        return _adaptador_sms().enviar(telefone, mensagem)
    except Exception:
        # Um SMS que falha nunca pode partir o pedido que o originou.
        logger.exception("Falha ao enviar SMS para %s", telefone)
        return False


def estado_sms():
    """Estado da integração, para o painel de configurações."""
    adaptador = _adaptador_sms()
    return {"provedor": adaptador.nome, "configurado": adaptador.configurado()}


# ─── Email ────────────────────────────────────────────────────────────────────


def enviar_email(assunto, template, contexto, para):
    try:
        corpo = render_to_string(template, contexto)
        send_mail(
            subject=assunto,
            message=corpo,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[para],
            fail_silently=False,
        )
        return True
    except Exception:
        logger.exception("Falha ao enviar email para %s", para)
        return False


# ─── Mensagens ────────────────────────────────────────────────────────────────


def avisar_reposicao(alerta):
    """Avisa, por email e por SMS, que a peça voltou ao stock."""
    produto = alerta.produto
    url = f"{settings.SITE_URL}{produto.get_absolute_url()}"

    enviar_email(
        assunto=f"{produto.marca.nome} {produto.nome} voltou ao stock",
        template="catalogo/email_reposicao.txt",
        contexto={"alerta": alerta, "produto": produto, "url": url},
        para=alerta.email,
    )

    enviar_sms(
        alerta.telefone,
        f"CHICOPLUG: {produto.marca.nome} {produto.nome} voltou ao stock. {url}",
    )
