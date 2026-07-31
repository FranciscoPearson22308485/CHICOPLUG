import crypto from "node:crypto";

import type { Payment, PaymentStatus } from "@prisma/client";

import { env } from "../../config/env.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { changeOrderStatus } from "../orders/orders.service.js";
import type { PaymentProvider } from "./provider.js";
import { MockPaymentProvider } from "./providers/mock.provider.js";
import { MulticaixaPaymentProvider } from "./providers/multicaixa.provider.js";

const mockProvider = new MockPaymentProvider();
const multicaixaProvider = new MulticaixaPaymentProvider();

export function getProvider(): PaymentProvider {
  return env.PAYMENTS_PROVIDER === "multicaixa" ? multicaixaProvider : mockProvider;
}

export function getMockProvider(): MockPaymentProvider {
  return mockProvider;
}

/** Estado da integração, apresentado no painel de administração. */
export function getProviderStatus(): {
  provider: string;
  configured: boolean;
  missing: string[];
} {
  const provider = getProvider();
  const missing: string[] = [];

  if (provider.name === "multicaixa") {
    if (!env.MULTICAIXA_POS_ID) missing.push("MULTICAIXA_POS_ID");
    if (!env.MULTICAIXA_API_URL) missing.push("MULTICAIXA_API_URL");
    if (!env.MULTICAIXA_CALLBACK_URL) missing.push("MULTICAIXA_CALLBACK_URL");
    if (!env.MULTICAIXA_CERT_PATH) missing.push("MULTICAIXA_CERT_PATH");
    if (!env.MULTICAIXA_WEBHOOK_SECRET) missing.push("MULTICAIXA_WEBHOOK_SECRET");
  }

  return { provider: provider.name, configured: provider.isConfigured(), missing };
}

export type SerializedPayment = {
  id: string;
  reference: string;
  provider: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  redirectUrl: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  failureReason: string | null;
  createdAt: string;
};

function serializePayment(payment: Payment, redirectUrl: string | null = null): SerializedPayment {
  return {
    id: payment.id,
    reference: payment.reference,
    provider: payment.provider,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    redirectUrl,
    expiresAt: payment.expiresAt?.toISOString() ?? null,
    paidAt: payment.paidAt?.toISOString() ?? null,
    failureReason: payment.failureReason,
    createdAt: payment.createdAt.toISOString(),
  };
}

/**
 * Inicia uma tentativa de pagamento para uma encomenda.
 *
 * Se já existir uma tentativa PENDENTE ainda válida, devolvemo-la em vez de
 * criar outra: recarregar a página de checkout não deve gerar cobranças
 * paralelas na app do banco do cliente.
 */
export async function createPaymentForOrder(orderReference: string): Promise<SerializedPayment> {
  const order = await prisma.order.findUnique({
    where: { reference: orderReference },
    include: { payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) throw notFound("Encomenda não encontrada.");

  if (order.status === "CANCELADA") throw badRequest("Esta encomenda foi cancelada.");

  const existing = order.payments.find(
    (p) => p.status === "PENDENTE" && (!p.expiresAt || p.expiresAt > new Date()),
  );
  if (existing) return serializePayment(existing);

  const provider = getProvider();
  const reference = `CPP-${crypto.randomBytes(10).toString("hex").toUpperCase()}`;

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: provider.name,
      status: "PENDENTE",
      amount: order.total,
      currency: "AOA",
      reference,
    },
  });

  try {
    const result = await provider.initiate({
      reference,
      amount: order.total,
      currency: "AOA",
      orderReference: order.reference,
      customerPhone: order.phone,
      customerEmail: order.email,
      description: `CHICOPLUG ${order.reference}`,
    });

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerRef: result.providerRef,
        status: result.status,
        expiresAt: result.expiresAt ?? null,
        rawPayload: result.raw as never,
      },
    });

    return serializePayment(updated, result.redirectUrl ?? null);
  } catch (error) {
    // A tentativa fica registada como FALHADA em vez de desaparecer: sem isto
    // uma falha do gateway seria invisível na reconciliação.
    const message = error instanceof Error ? error.message : String(error);
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FALHADO", failureReason: message },
    });
    throw error;
  }
}

/**
 * Aplica um resultado de pagamento e propaga-o para a encomenda.
 *
 * Idempotente: callbacks repetidos (a EMIS reenvia em caso de timeout) não
 * podem confirmar a mesma encomenda duas vezes.
 */
export async function applyPaymentResult(input: {
  reference: string;
  status: PaymentStatus;
  providerRef?: string | null;
  failureReason?: string | null;
  raw?: unknown;
}): Promise<SerializedPayment> {
  const payment = await prisma.payment.findUnique({
    where: { reference: input.reference },
    include: { order: true },
  });
  if (!payment) throw notFound("Pagamento não encontrado.");

  if (payment.status === input.status) return serializePayment(payment);

  // Um pagamento já concluído não regressa a PENDENTE.
  if (payment.status !== "PENDENTE") {
    logger.warn("Callback ignorado: pagamento já concluído", {
      reference: payment.reference,
      current: payment.status,
      received: input.status,
    });
    return serializePayment(payment);
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: input.status,
      providerRef: input.providerRef ?? payment.providerRef,
      failureReason: input.failureReason ?? null,
      paidAt: input.status === "PAGO" ? new Date() : null,
      ...(input.raw !== undefined ? { rawPayload: input.raw as never } : {}),
    },
  });

  // Propagação para o estado da encomenda.
  if (input.status === "PAGO" && payment.order.status === "NOVA") {
    await changeOrderStatus(payment.orderId, "CONFIRMADA", {
      note: `Pagamento confirmado (${payment.provider}).`,
    });
  }

  if (input.status === "CANCELADO" && payment.order.status === "NOVA") {
    await changeOrderStatus(payment.orderId, "CANCELADA", {
      note: "Pagamento cancelado pelo cliente.",
    });
  }

  logger.info("Resultado de pagamento aplicado", {
    reference: payment.reference,
    status: input.status,
  });

  return serializePayment(updated);
}

/** Consulta do estado — usada pelo polling do ecrã de checkout. */
export async function refreshPaymentStatus(reference: string): Promise<SerializedPayment> {
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment) throw notFound("Pagamento não encontrado.");

  if (payment.status !== "PENDENTE") return serializePayment(payment);

  // Uma tentativa expirada não fica pendente para sempre.
  if (payment.expiresAt && payment.expiresAt < new Date()) {
    return applyPaymentResult({
      reference,
      status: "FALHADO",
      failureReason: "Tempo de confirmação esgotado.",
    });
  }

  const provider = getProvider();
  const result = await provider.getStatus({
    reference: payment.reference,
    providerRef: payment.providerRef,
  });

  if (result.status === payment.status) return serializePayment(payment);

  return applyPaymentResult({
    reference,
    status: result.status,
    providerRef: result.providerRef ?? null,
    failureReason: result.failureReason ?? null,
    raw: result.raw,
  });
}

export async function cancelPayment(reference: string): Promise<SerializedPayment> {
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment) throw notFound("Pagamento não encontrado.");
  if (payment.status !== "PENDENTE") throw badRequest("Este pagamento já não está pendente.");

  const provider = getProvider();
  if (provider.cancel) {
    await provider.cancel({ reference, providerRef: payment.providerRef });
  }

  return applyPaymentResult({
    reference,
    status: "CANCELADO",
    failureReason: "Cancelado pelo cliente.",
  });
}
