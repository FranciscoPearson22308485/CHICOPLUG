"""
Pagamentos — porta e adaptadores.

A loja fala sempre com `iniciar_pagamento` / `consultar_estado`, nunca com a
EMIS directamente. É isso que permite ter hoje um simulador local funcional e
ligar o Multicaixa Express amanhã mudando uma variável de ambiente.
"""

import hashlib
import hmac
import json
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from .models import EstadoPagamento, Pagamento
from .services import nova_referencia_pagamento

logger = logging.getLogger(__name__)


class ProvedorNaoConfigurado(Exception):
    """O adaptador existe mas faltam-lhe credenciais."""


# ─── Simulador ────────────────────────────────────────────────────────────────


class Simulador:
    """
    Reproduz fielmente o fluxo assíncrono do Multicaixa Express — o pagamento
    é confirmado fora do pedido HTTP original — para que o checkout, o polling
    e os estados sejam exercitados a sério sem credenciais.
    """

    nome = "simulador"

    def configurado(self):
        return True

    def iniciar(self, pagamento):
        return {
            "referencia_provedor": f"SIM-{secrets.token_hex(6).upper()}",
            "estado": EstadoPagamento.PENDENTE,
            "url_redireccao": None,
            # 15 minutos, como a janela real de confirmação.
            "expira_em": timezone.now() + timedelta(minutes=15),
            "bruto": {"simulado": True, "montante": pagamento.montante},
        }

    def consultar(self, pagamento):
        return {"estado": pagamento.estado, "bruto": {"simulado": True}}

    def ler_callback(self, corpo, cabecalhos):
        dados = json.loads(corpo or "{}")
        if not dados.get("referencia") or not dados.get("estado"):
            return None
        return {
            "referencia": dados["referencia"],
            "estado": dados["estado"],
            "referencia_provedor": dados.get("referencia_provedor"),
            "motivo": dados.get("motivo", ""),
            "bruto": dados,
        }


# ─── Multicaixa Express (EMIS) ────────────────────────────────────────────────


class MulticaixaExpress:
    """
    ─────────────────────────────────────────────────────────────────────────
    ESTADO: ARQUITECTURA COMPLETA, CREDENCIAIS PENDENTES.

    A EMIS não publica documentação nem ambiente de testes abertos: o POS ID, o
    certificado cliente (mTLS) e o formato do callback são entregues ao
    comerciante na adesão. O fluxo aqui segue o GPO Frame conhecido:

      1. POST {MULTICAIXA_API_URL}/frameToken  →  devolve um `id`
      2. O cliente confirma na app do banco
      3. A EMIS chama o nosso MULTICAIXA_CALLBACK_URL com o resultado

    ANTES DE ACTIVAR EM PRODUÇÃO, confirmar contra a documentação recebida:
      · nomes dos campos do corpo de `frameToken`;
      · formato e campos do callback (`ler_callback`);
      · esquema de assinatura do webhook — o HMAC abaixo é a nossa suposição
        defensiva; se a EMIS usar outro, substituir `_assinatura_valida`;
      · existência de endpoint de consulta de estado (hoje não há, e por isso
        `consultar` assume PENDENTE até chegar o callback).
    ─────────────────────────────────────────────────────────────────────────
    """

    nome = "multicaixa"

    def configurado(self):
        return bool(settings.MULTICAIXA_POS_ID and settings.MULTICAIXA_API_URL)

    def em_falta(self):
        chaves = {
            "MULTICAIXA_POS_ID": settings.MULTICAIXA_POS_ID,
            "MULTICAIXA_API_URL": settings.MULTICAIXA_API_URL,
            "MULTICAIXA_CALLBACK_URL": settings.MULTICAIXA_CALLBACK_URL,
            "MULTICAIXA_CERT_PATH": settings.MULTICAIXA_CERT_PATH,
            "MULTICAIXA_WEBHOOK_SECRET": settings.MULTICAIXA_WEBHOOK_SECRET,
        }
        return [nome for nome, valor in chaves.items() if not valor]

    def iniciar(self, pagamento):
        if not self.configurado():
            raise ProvedorNaoConfigurado(
                "Multicaixa Express ainda não está configurado. "
                "Define MULTICAIXA_POS_ID e MULTICAIXA_API_URL."
            )

        import requests

        corpo = {
            # CONFIRMAR NOMES CONTRA A DOCUMENTAÇÃO OFICIAL DA EMIS.
            "reference": pagamento.referencia,
            "amount": f"{pagamento.montante:.2f}",
            "token": settings.MULTICAIXA_POS_ID,
            "mobile": "PAYMENT",
            "card": "DISABLED",
            "qrCode": "PAYMENT",
            "callbackUrl": settings.MULTICAIXA_CALLBACK_URL,
        }

        # A EMIS exige mTLS: o certificado identifica o comerciante.
        cert = settings.MULTICAIXA_CERT_PATH or None

        try:
            resposta = requests.post(
                f"{settings.MULTICAIXA_API_URL}/frameToken",
                json=corpo,
                cert=cert,
                timeout=20,
            )
        except Exception as erro:
            logger.error("Multicaixa inacessível: %s", erro)
            return {"estado": EstadoPagamento.FALHADO, "bruto": {"erro": str(erro)}}

        bruto = resposta.json() if resposta.content else {}

        if not resposta.ok or not bruto.get("id"):
            logger.error("Multicaixa devolveu erro %s: %s", resposta.status_code, bruto)
            return {"estado": EstadoPagamento.FALHADO, "bruto": bruto}

        token = bruto["id"]
        return {
            "referencia_provedor": token,
            "estado": EstadoPagamento.PENDENTE,
            "url_redireccao": f"{settings.MULTICAIXA_API_URL}/frame?token={token}",
            "expira_em": timezone.now() + timedelta(minutes=15),
            "bruto": bruto,
        }

    def consultar(self, pagamento):
        # Sem endpoint público de consulta: o callback é a única fonte.
        return {"estado": pagamento.estado, "bruto": {"nota": "Consulta activa indisponível."}}

    def _assinatura_valida(self, corpo, cabecalhos):
        segredo = settings.MULTICAIXA_WEBHOOK_SECRET
        if not segredo:
            logger.warning("Callback aceite sem verificação: MULTICAIXA_WEBHOOK_SECRET vazio.")
            return True

        recebida = cabecalhos.get("HTTP_X_EMIS_SIGNATURE", "")
        esperada = hmac.new(segredo.encode(), corpo.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(esperada, recebida)

    def ler_callback(self, corpo, cabecalhos):
        if not self._assinatura_valida(corpo, cabecalhos):
            logger.warning("Assinatura de callback Multicaixa inválida.")
            return None

        dados = json.loads(corpo or "{}")

        # Aceitamos várias grafias porque o nome exacto do campo varia entre
        # integrações conhecidas — a confirmar com a documentação oficial.
        referencia = (
            dados.get("reference") or dados.get("merchantTransactionId") or dados.get("clientId")
        )
        if not referencia:
            return None

        bruto_estado = str(dados.get("status") or dados.get("resultCode") or "").upper()
        if bruto_estado in {"ACCEPTED", "SUCCESS", "00", "PAGO"}:
            estado = EstadoPagamento.PAGO
        elif bruto_estado in {"REJECTED", "FAILED", "FALHADO"}:
            estado = EstadoPagamento.FALHADO
        elif bruto_estado in {"CANCELLED", "CANCELED", "CANCELADO"}:
            estado = EstadoPagamento.CANCELADO
        else:
            estado = EstadoPagamento.PENDENTE

        return {
            "referencia": referencia,
            "estado": estado,
            "referencia_provedor": dados.get("id") or dados.get("transactionId"),
            "motivo": dados.get("errorMessage") or dados.get("message", ""),
            "bruto": dados,
        }


# ─── Selecção e uso ───────────────────────────────────────────────────────────


def provedor():
    return MulticaixaExpress() if settings.PAGAMENTOS_PROVEDOR == "multicaixa" else Simulador()


def estado_integracao():
    """Apresentado no painel para dizer o que falta configurar."""
    p = provedor()
    return {
        "provedor": p.nome,
        "configurado": p.configurado(),
        "em_falta": p.em_falta() if hasattr(p, "em_falta") else [],
    }


def iniciar_pagamento(encomenda):
    """
    Cria (ou reaproveita) uma tentativa de pagamento.

    Recarregar a página de checkout não deve gerar cobranças paralelas na app
    do banco do cliente, por isso uma tentativa pendente ainda válida é
    devolvida em vez de se criar outra.
    """
    existente = encomenda.pagamentos.filter(estado=EstadoPagamento.PENDENTE).first()
    if existente and not existente.expirado:
        return existente

    p = provedor()
    pagamento = Pagamento.objects.create(
        encomenda=encomenda,
        provedor=p.nome,
        montante=encomenda.total,
        referencia=nova_referencia_pagamento(),
    )

    try:
        resultado = p.iniciar(pagamento)
    except ProvedorNaoConfigurado as erro:
        # A tentativa fica registada como falhada em vez de desaparecer: sem
        # isso, uma falha do gateway seria invisível na reconciliação.
        pagamento.estado = EstadoPagamento.FALHADO
        pagamento.motivo_falha = str(erro)
        pagamento.save()
        raise

    pagamento.estado = resultado.get("estado", EstadoPagamento.PENDENTE)
    pagamento.referencia_provedor = resultado.get("referencia_provedor") or ""
    pagamento.expira_em = resultado.get("expira_em")
    pagamento.resposta_bruta = resultado.get("bruto")
    pagamento.save()

    return pagamento
