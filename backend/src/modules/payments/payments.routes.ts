import { Router } from "express";
import { z } from "zod";

import { env } from "../../config/env.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { badRequest } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { validate } from "../../middleware/validate.js";
import * as service from "./payments.service.js";

export const paymentsRouter = Router();

const referenceParamSchema = z.object({ reference: z.string().trim().min(1).max(80) });

/** Estado da integração — consumido pelo ecrã /admin/configuracoes. */
paymentsRouter.get("/status", (_req, res) => {
  res.json(service.getProviderStatus());
});

/** Reinicia o pagamento de uma encomenda (botão "tentar de novo"). */
paymentsRouter.post(
  "/orders/:reference/start",
  validate({ params: z.object({ reference: z.string().regex(/^CP-\d+$/i) }) }),
  asyncHandler(async (req, res) => {
    const payment = await service.createPaymentForOrder(req.params.reference!.toUpperCase());
    res.status(201).json({ payment });
  }),
);

/** Polling do ecrã de checkout enquanto aguarda confirmação na app do banco. */
paymentsRouter.get(
  "/:reference",
  validate({ params: referenceParamSchema }),
  asyncHandler(async (req, res) => {
    const payment = await service.refreshPaymentStatus(req.params.reference!);
    // Nunca cachear estado de pagamento.
    res.set("Cache-Control", "no-store");
    res.json({ payment });
  }),
);

paymentsRouter.post(
  "/:reference/cancel",
  validate({ params: referenceParamSchema }),
  asyncHandler(async (req, res) => {
    res.json({ payment: await service.cancelPayment(req.params.reference!) });
  }),
);

/**
 * Callback do Multicaixa Express.
 *
 * Sem autenticação de sessão — quem chama é a EMIS, não o browser. A confiança
 * vem exclusivamente da verificação de assinatura dentro de `parseCallback`.
 * Respondemos sempre 200 quando o payload é reconhecido: um erro nosso não deve
 * fazer o gateway reenviar indefinidamente.
 */
paymentsRouter.post(
  "/multicaixa/callback",
  asyncHandler(async (req, res) => {
    const provider = service.getProvider();
    const parsed = provider.parseCallback(req.body, req.headers);

    if (!parsed) {
      logger.warn("Callback de pagamento rejeitado", { provider: provider.name });
      res.status(400).json({ received: false, reason: "Payload inválido ou não assinado." });
      return;
    }

    await service.applyPaymentResult({
      reference: parsed.reference,
      status: parsed.status,
      providerRef: parsed.providerRef ?? null,
      failureReason: parsed.failureReason ?? null,
      raw: parsed.raw,
    });

    res.json({ received: true });
  }),
);

/**
 * Simulação do resultado de pagamento. Reproduz aquilo que a app Multicaixa
 * Express faria e permite testar o fluxo completo sem credenciais.
 * Bloqueado em produção.
 */
paymentsRouter.post(
  "/simulate",
  validate({
    body: z.object({
      reference: z.string().trim().min(1),
      status: z.enum(["PAGO", "CANCELADO", "FALHADO"]),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (env.isProduction) throw badRequest("Simulação indisponível em produção.");

    service.getMockProvider().setState(req.body.reference, req.body.status);

    const payment = await service.applyPaymentResult({
      reference: req.body.reference,
      status: req.body.status,
      failureReason: req.body.status === "FALHADO" ? "Simulação de falha." : null,
    });

    res.json({ payment });
  }),
);
