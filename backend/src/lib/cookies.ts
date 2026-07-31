import type { CookieOptions, Response } from "express";

import { env } from "../config/env.js";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "../middleware/auth.js";
import { parseDuration } from "./tokens.js";

/**
 * `sameSite: "none"` em produção porque a API pode viver noutro subdomínio
 * (api.chicoplug.ao) — e "none" obriga a `secure: true`. Em desenvolvimento
 * usamos "lax" para que o proxy do Vite funcione sem HTTPS.
 */
function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: env.isProduction ? "none" : "lax",
    secure: env.isProduction,
    path: "/",
  };
}

export function setSessionCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string; refreshExpiresAt: Date },
): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(),
    maxAge: parseDuration(env.JWT_ACCESS_TTL),
  });

  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(),
    // Restringido ao endpoint de refresh: reduz a superfície caso um proxy
    // ou log intermédio capture cabeçalhos de pedidos normais.
    path: "/api/auth",
    expires: tokens.refreshExpiresAt,
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions() });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: "/api/auth" });
}

export const CART_COOKIE = "cp_cart";

export function setCartCookie(res: Response, sessionId: string): void {
  res.cookie(CART_COOKIE, sessionId, {
    ...baseOptions(),
    maxAge: 90 * 24 * 60 * 60 * 1000,
  });
}

export function clearCartCookie(res: Response): void {
  res.clearCookie(CART_COOKIE, { ...baseOptions() });
}
