import rateLimit, { type Options } from "express-rate-limit";

import { env } from "../config/env.js";

function make(options: Partial<Options> & { windowMs: number; limit: number }) {
  return rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Os testes de integração fariam disparar qualquer limite ao fim de segundos.
    skip: () => env.isTest,
    handler: (_req, res) => {
      res.status(429).json({
        error: { code: "TOO_MANY_REQUESTS", message: "Demasiados pedidos. Tenta mais tarde." },
      });
    },
    ...options,
  });
}

/** Limite geral da API. */
export const apiLimiter = make({ windowMs: 15 * 60_000, limit: 1000 });

/**
 * Login e registo são os alvos de força bruta. Chaveamos por IP **e** email
 * para que atacar uma conta a partir de vários IPs continue a ser travado.
 */
export const authLimiter = make({
  windowMs: 15 * 60_000,
  limit: 10,
  keyGenerator: (req) => {
    const email =
      typeof (req.body as Record<string, unknown> | undefined)?.["email"] === "string"
        ? String((req.body as Record<string, unknown>)["email"]).toLowerCase()
        : "";
    return `${req.ip ?? "sem-ip"}:${email}`;
  },
  skipSuccessfulRequests: true,
});

/** Reposição de password: baixo volume legítimo, alto potencial de abuso. */
export const passwordResetLimiter = make({ windowMs: 60 * 60_000, limit: 5 });

/** Criação de encomendas — trava carrinhos automatizados. */
export const checkoutLimiter = make({ windowMs: 10 * 60_000, limit: 20 });

/** Uploads são caros (Sharp + rede). */
export const uploadLimiter = make({ windowMs: 15 * 60_000, limit: 60 });
