import crypto from "node:crypto";

import type { RequestHandler } from "express";

import { env } from "../config/env.js";
import { forbidden } from "../lib/errors.js";

export const CSRF_COOKIE = "cp_csrf";
export const CSRF_HEADER = "x-csrf-token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Padrão double-submit cookie.
 *
 * Como a sessão vive num cookie httpOnly, o browser envia-a automaticamente —
 * incluindo em pedidos disparados por outro site. A defesa: exigir que o valor
 * do cookie `cp_csrf` (legível por JavaScript, logo acessível só à mesma
 * origem) seja repetido no cabeçalho `x-csrf-token`. Um site terceiro consegue
 * provocar o pedido, mas não consegue ler o cookie para preencher o cabeçalho.
 */
export const issueCsrfToken: RequestHandler = (req, res, next) => {
  const cookies = req.cookies as Record<string, string> | undefined;
  if (!cookies?.[CSRF_COOKIE]) {
    const token = crypto.randomBytes(24).toString("base64url");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // Propositado: o cliente tem de o poder ler.
      sameSite: env.isProduction ? "none" : "lax",
      secure: env.isProduction,
      path: "/",
      maxAge: 12 * 60 * 60 * 1000,
    });
    // Disponibiliza-o já neste pedido, sem esperar pelo próximo.
    (req.cookies as Record<string, string>) = { ...(cookies ?? {}), [CSRF_COOKIE]: token };
  }
  next();
};

export const verifyCsrf: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  // Clientes que autenticam por Bearer não usam cookies, logo não são
  // vulneráveis a CSRF — e não devem ser obrigados a este handshake.
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return next();

  const cookies = req.cookies as Record<string, string> | undefined;
  const cookieToken = cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || typeof headerToken !== "string" || !headerToken) {
    return next(forbidden("Token CSRF em falta."));
  }

  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(forbidden("Token CSRF inválido."));
  }

  next();
};
