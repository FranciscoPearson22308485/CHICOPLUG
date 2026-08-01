import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../../lib/async-handler.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, requireAdmin } from "../../middleware/auth.js";
import { passwordResetLimiter } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";

export const newsletterRouter = Router();

const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido.").max(254),
  /** Onde a inscrição foi feita, para medir a conversão de cada ponto. */
  source: z.enum(["footer", "home", "checkout"]).optional().default("footer"),
});

/**
 * Inscrição na newsletter.
 *
 * Idempotente e discreta: reinscrever um email já activo devolve sucesso em vez
 * de erro — quem escreve o email duas vezes não fez nada de errado, e um 409
 * revelaria que aquele endereço já está na lista.
 */
newsletterRouter.post(
  "/subscribe",
  passwordResetLimiter,
  validate({ body: subscribeSchema }),
  asyncHandler(async (req, res) => {
    const { email, source } = req.body as { email: string; source: string };

    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: { email, source },
      // Reactiva quem se tinha removido.
      update: { active: true, unsubscribedAt: null },
    });

    res.status(201).json({
      subscribed: true,
      message: "Inscrição feita. Vais saber das novidades em primeira mão.",
    });
  }),
);

newsletterRouter.post(
  "/unsubscribe",
  validate({ body: z.object({ email: z.string().trim().toLowerCase().email() }) }),
  asyncHandler(async (req, res) => {
    await prisma.newsletterSubscriber.updateMany({
      where: { email: req.body.email, active: true },
      data: { active: false, unsubscribedAt: new Date() },
    });

    // Resposta igual exista ou não o email — não confirmamos quem está na lista.
    res.json({ subscribed: false, message: "Inscrição removida." });
  }),
);

/** Lista de subscritores, para o painel de administração. */
newsletterRouter.get(
  "/",
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [subscribers, total, active] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.newsletterSubscriber.count(),
      prisma.newsletterSubscriber.count({ where: { active: true } }),
    ]);

    res.json({
      subscribers: subscribers.map((s) => ({
        id: s.id,
        email: s.email,
        source: s.source,
        active: s.active,
        createdAt: s.createdAt.toISOString(),
      })),
      total,
      active,
    });
  }),
);
