import crypto from "node:crypto";

import type { PaymentStatus } from "@prisma/client";

import { logger } from "../../../lib/logger.js";
import type {
  CallbackResult,
  InitiateInput,
  InitiateResult,
  PaymentProvider,
  StatusResult,
} from "../provider.js";

/**
 * Simulador local do fluxo Multicaixa Express.
 *
 * Reproduz fielmente a forma do provedor real — pagamento assíncrono, confirmado
 * fora do pedido HTTP original — para que o checkout, o polling e os estados
 * sejam exercitados a sério em desenvolvimento e nos testes. A única diferença é
 * que aqui a confirmação é despoletada por um endpoint de simulação em vez de
 * pela app do banco.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  /** Estado em memória por referência de pagamento. */
  private readonly states = new Map<string, PaymentStatus>();

  isConfigured(): boolean {
    return true;
  }

  initiate(input: InitiateInput): Promise<InitiateResult> {
    const providerRef = `MOCK-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
    this.states.set(input.reference, "PENDENTE");

    logger.info("Pagamento simulado iniciado", {
      reference: input.reference,
      amount: input.amount,
    });

    return Promise.resolve({
      providerRef,
      status: "PENDENTE" as PaymentStatus,
      redirectUrl: null,
      // 15 minutos, como a janela real de confirmação do Multicaixa Express.
      expiresAt: new Date(Date.now() + 15 * 60_000),
      raw: { simulated: true, providerRef, amount: input.amount },
    });
  }

  getStatus(payment: { reference: string; providerRef: string | null }): Promise<StatusResult> {
    return Promise.resolve({
      status: this.states.get(payment.reference) ?? "PENDENTE",
      providerRef: payment.providerRef,
      raw: { simulated: true },
    });
  }

  parseCallback(payload: unknown): CallbackResult | null {
    if (!payload || typeof payload !== "object") return null;
    const body = payload as Record<string, unknown>;

    const reference = typeof body["reference"] === "string" ? body["reference"] : null;
    const status = typeof body["status"] === "string" ? body["status"] : null;
    if (!reference || !status) return null;

    const allowed: PaymentStatus[] = ["PENDENTE", "PAGO", "CANCELADO", "FALHADO"];
    if (!allowed.includes(status as PaymentStatus)) return null;

    this.states.set(reference, status as PaymentStatus);

    return {
      reference,
      status: status as PaymentStatus,
      providerRef: typeof body["providerRef"] === "string" ? body["providerRef"] : null,
      failureReason:
        typeof body["failureReason"] === "string" ? body["failureReason"] : null,
      raw: payload,
    };
  }

  cancel(payment: { reference: string; providerRef: string | null }): Promise<StatusResult> {
    this.states.set(payment.reference, "CANCELADO");
    return Promise.resolve({
      status: "CANCELADO" as PaymentStatus,
      providerRef: payment.providerRef,
      raw: { simulated: true, cancelled: true },
    });
  }

  /** Usado pelo endpoint de simulação e pelos testes. */
  setState(reference: string, status: PaymentStatus): void {
    this.states.set(reference, status);
  }
}
