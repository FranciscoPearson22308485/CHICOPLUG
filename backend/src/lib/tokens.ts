import crypto from "node:crypto";

import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";

import { env } from "../config/env.js";
import { unauthorized } from "./errors.js";

export type AccessPayload = {
  sub: string;
  email: string;
  role: Role;
};

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    issuer: "chicoplug",
    audience: "chicoplug-web",
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: "chicoplug",
      audience: "chicoplug-web",
    });
    if (typeof decoded === "string") throw new Error("payload inesperado");
    return { sub: String(decoded.sub), email: String(decoded.email), role: decoded.role as Role };
  } catch {
    throw unauthorized("Sessão inválida ou expirada.");
  }
}

/**
 * O refresh token é aleatório e opaco (não é JWT): permite revogação imediata
 * do lado do servidor, coisa que um JWT auto-contido não permite.
 */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Gera um token de reposição de password (enviado por email, guardado em hash). */
export function generateOpaqueToken(bytes = 32): { token: string; hash: string } {
  const token = crypto.randomBytes(bytes).toString("base64url");
  return { token, hash: hashToken(token) };
}

/** Converte "30d" / "15m" / "45s" para milissegundos. */
export function parseDuration(value: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) throw new Error(`Duração inválida: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return amount * factor;
}
