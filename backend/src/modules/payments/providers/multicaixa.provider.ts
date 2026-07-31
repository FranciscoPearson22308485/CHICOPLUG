import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";

import type { PaymentStatus } from "@prisma/client";

import { env } from "../../../config/env.js";
import { serviceUnavailable } from "../../../lib/errors.js";
import { logger } from "../../../lib/logger.js";
import type {
  CallbackResult,
  InitiateInput,
  InitiateResult,
  PaymentProvider,
  StatusResult,
} from "../provider.js";

/**
 * Adaptador Multicaixa Express (EMIS — Gateway de Pagamento Online).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTADO: ARQUITECTURA COMPLETA, CREDENCIAIS PENDENTES.
 *
 * A EMIS não publica documentação nem ambiente de testes abertos: o POS ID, o
 * certificado cliente (mTLS) e o formato exacto do callback são entregues
 * directamente ao comerciante na adesão. O que está aqui segue o fluxo público
 * conhecido do GPO Frame:
 *
 *   1. POST {MULTICAIXA_API_URL}/frameToken  →  devolve um `id` (token da sessão)
 *   2. O cliente é enviado para .../frame?token=<id> e confirma na app do banco
 *   3. A EMIS invoca o nosso MULTICAIXA_CALLBACK_URL com o resultado
 *
 * ANTES DE ACTIVAR EM PRODUÇÃO, confirmar com a documentação oficial recebida:
 *   · nomes exactos dos campos do corpo de `frameToken`;
 *   · formato e campos do callback (`parseCallback` abaixo);
 *   · mecanismo real de assinatura do webhook (o HMAC aqui é a nossa suposição
 *     defensiva — se a EMIS usar outro esquema, substituir `verifySignature`);
 *   · existência (ou não) de endpoint de consulta de estado — hoje `getStatus`
 *     não tem para onde perguntar e assume-se PENDENTE até chegar o callback.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class MulticaixaPaymentProvider implements PaymentProvider {
  readonly name = "multicaixa";

  isConfigured(): boolean {
    return env.multicaixaConfigured;
  }

  /**
   * A EMIS exige mTLS: o certificado cliente identifica o comerciante. Sem
   * ficheiro configurado seguimos sem agente — útil para ambientes de teste que
   * a EMIS eventualmente disponibilize sem certificado.
   */
  private buildAgent(): https.Agent | undefined {
    if (!env.MULTICAIXA_CERT_PATH) return undefined;

    try {
      const pfx = fs.readFileSync(env.MULTICAIXA_CERT_PATH);
      return new https.Agent({
        pfx,
        passphrase: env.MULTICAIXA_CERT_PASSPHRASE || undefined,
        keepAlive: true,
      });
    } catch (error) {
      logger.error("Falha ao carregar o certificado Multicaixa", {
        path: env.MULTICAIXA_CERT_PATH,
        message: error instanceof Error ? error.message : String(error),
      });
      throw serviceUnavailable("Certificado Multicaixa inválido ou ilegível.");
    }
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw serviceUnavailable(
        "Multicaixa Express ainda não está configurado. " +
          "Define MULTICAIXA_POS_ID e MULTICAIXA_API_URL no ambiente.",
        { missing: ["MULTICAIXA_POS_ID", "MULTICAIXA_API_URL"] },
      );
    }
  }

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    this.assertConfigured();

    const body = {
      // CONFIRMAR NOMES CONTRA A DOCUMENTAÇÃO OFICIAL DA EMIS.
      reference: input.reference,
      // O gateway espera o montante em Kwanzas com duas casas decimais.
      amount: (input.amount / 1).toFixed(2),
      token: env.MULTICAIXA_POS_ID,
      mobile: "PAYMENT",
      card: "DISABLED",
      qrCode: "PAYMENT",
      callbackUrl: env.MULTICAIXA_CALLBACK_URL,
    };

    const agent = this.buildAgent();

    let response: Response;
    try {
      response = await fetch(`${env.MULTICAIXA_API_URL}/frameToken`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
        // `dispatcher`/`agent` conforme o runtime; o Node 20+ aceita via undici.
        ...(agent ? { agent } : {}),
        signal: AbortSignal.timeout(20_000),
      } as RequestInit);
    } catch (error) {
      logger.error("Multicaixa inacessível", {
        message: error instanceof Error ? error.message : String(error),
      });
      throw serviceUnavailable("Não foi possível contactar o Multicaixa Express.");
    }

    const raw: unknown = await response.json().catch(() => ({}));

    if (!response.ok) {
      logger.error("Multicaixa devolveu erro", { status: response.status, raw });
      return {
        providerRef: null,
        status: "FALHADO",
        redirectUrl: null,
        expiresAt: null,
        raw,
      };
    }

    const payload = raw as Record<string, unknown>;
    const token = typeof payload["id"] === "string" ? payload["id"] : null;

    if (!token) {
      return { providerRef: null, status: "FALHADO", redirectUrl: null, expiresAt: null, raw };
    }

    return {
      providerRef: token,
      status: "PENDENTE",
      redirectUrl: `${env.MULTICAIXA_API_URL}/frame?token=${encodeURIComponent(token)}`,
      expiresAt: new Date(Date.now() + 15 * 60_000),
      raw,
    };
  }

  /**
   * A EMIS é orientada a callback: não há endpoint público de consulta. Mantemos
   * PENDENTE e deixamos o callback (ou a expiração) resolver — quando a
   * documentação oficial expuser consulta de estado, é aqui que entra.
   */
  getStatus(payment: { reference: string; providerRef: string | null }): Promise<StatusResult> {
    this.assertConfigured();
    return Promise.resolve({
      status: "PENDENTE" as PaymentStatus,
      providerRef: payment.providerRef,
      raw: { note: "Consulta activa não disponível no gateway EMIS." },
    });
  }

  /**
   * Verificação de assinatura do webhook.
   *
   * SUPOSIÇÃO DEFENSIVA: HMAC-SHA256 do corpo bruto no cabeçalho
   * `x-emis-signature`. Substituir pelo esquema real quando a EMIS o
   * documentar. Sem `MULTICAIXA_WEBHOOK_SECRET` definido não verificamos —
   * e isso está registado em log como aviso, porque em produção é inaceitável.
   */
  private verifySignature(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    const secret = env.MULTICAIXA_WEBHOOK_SECRET;
    if (!secret) {
      logger.warn("Callback Multicaixa aceite sem verificação de assinatura", {
        reason: "MULTICAIXA_WEBHOOK_SECRET não definido",
      });
      return true;
    }

    const header = headers["x-emis-signature"];
    const received = Array.isArray(header) ? header[0] : header;
    if (!received) return false;

    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(received);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  parseCallback(
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
  ): CallbackResult | null {
    if (!payload || typeof payload !== "object") return null;

    if (!this.verifySignature(JSON.stringify(payload), headers)) {
      logger.warn("Assinatura de callback Multicaixa inválida");
      return null;
    }

    const body = payload as Record<string, unknown>;

    // CONFIRMAR CONTRA A DOCUMENTAÇÃO OFICIAL: aceitamos várias grafias porque
    // o nome exacto do campo de referência varia entre integrações conhecidas.
    const reference =
      (typeof body["reference"] === "string" && body["reference"]) ||
      (typeof body["merchantTransactionId"] === "string" && body["merchantTransactionId"]) ||
      (typeof body["clientId"] === "string" && body["clientId"]) ||
      null;

    if (!reference) return null;

    const rawStatus = String(body["status"] ?? body["resultCode"] ?? "").toUpperCase();

    const status: PaymentStatus =
      rawStatus === "ACCEPTED" || rawStatus === "SUCCESS" || rawStatus === "00" || rawStatus === "PAGO"
        ? "PAGO"
        : rawStatus === "REJECTED" || rawStatus === "FAILED" || rawStatus === "FALHADO"
          ? "FALHADO"
          : rawStatus === "CANCELLED" || rawStatus === "CANCELED" || rawStatus === "CANCELADO"
            ? "CANCELADO"
            : "PENDENTE";

    return {
      reference,
      status,
      providerRef:
        (typeof body["id"] === "string" && body["id"]) ||
        (typeof body["transactionId"] === "string" && body["transactionId"]) ||
        null,
      failureReason:
        typeof body["errorMessage"] === "string"
          ? body["errorMessage"]
          : typeof body["message"] === "string"
            ? body["message"]
            : null,
      raw: payload,
    };
  }
}
