import type { NextFunction, Request, RequestHandler, Response } from "express";

import { forbidden, unauthorized } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/tokens.js";

export const ACCESS_COOKIE = "cp_access";
export const REFRESH_COOKIE = "cp_refresh";

/**
 * Aceita o token no cookie httpOnly (caminho normal do browser) ou no cabeçalho
 * `Authorization: Bearer` (útil para testes e integrações servidor-a-servidor).
 */
function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim() || null;

  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[ACCESS_COOKIE] ?? null;
}

/** Exige sessão válida. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next(unauthorized());

  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, email: payload.email, role: payload.role };
    next();
    return;
  } catch (error) {
    next(error);
    return;
  }
};

/**
 * Preenche `req.auth` quando há sessão, mas deixa passar visitantes anónimos.
 * Usado no carrinho, que funciona com e sem conta.
 */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, email: payload.email, role: payload.role };
  } catch {
    // Um token expirado não deve bloquear a navegação anónima.
  }
  next();
};

/** Exige perfil de administrador. Usar sempre depois de `authenticate`. */
export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.auth) return next(unauthorized());
  if (req.auth.role !== "ADMIN") return next(forbidden("Área reservada a administradores."));
  next();
};
