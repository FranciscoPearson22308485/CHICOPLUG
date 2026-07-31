import type { Role, User } from "@prisma/client";

import { env } from "../../config/env.js";
import { badRequest, conflict, notFound, unauthorized } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { fakeVerifyPassword, hashPassword, verifyPassword } from "../../lib/password.js";
import { prisma } from "../../lib/prisma.js";
import {
  generateOpaqueToken,
  generateRefreshToken,
  hashToken,
  parseDuration,
  signAccessToken,
} from "../../lib/tokens.js";
import type { RegisterInput, UpdateProfileInput } from "./auth.schemas.js";

export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  marketingOptIn: boolean;
  createdAt: string;
};

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    marketingOptIn: user.marketingOptIn,
    createdAt: user.createdAt.toISOString(),
  };
}

type SessionMeta = { userAgent?: string | undefined; ip?: string | undefined };

export type IssuedSession = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

async function issueSession(user: User, meta: SessionMeta): Promise<IssuedSession> {
  const { token, hash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + parseDuration(env.JWT_REFRESH_TTL));

  await prisma.refreshToken.create({
    data: {
      tokenHash: hash,
      userId: user.id,
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
    },
  });

  return {
    user: toPublicUser(user),
    accessToken: signAccessToken({ sub: user.id, email: user.email, role: user.role }),
    refreshToken: token,
    refreshExpiresAt: expiresAt,
  };
}

export async function register(input: RegisterInput, meta: SessionMeta): Promise<IssuedSession> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("Já existe uma conta com este email.");

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? null,
      marketingOptIn: input.marketingOptIn,
    },
  });

  logger.info("Nova conta criada", { userId: user.id });
  return issueSession(user, meta);
}

export async function login(
  email: string,
  password: string,
  meta: SessionMeta,
): Promise<IssuedSession> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Gasta o mesmo tempo que uma verificação real para não revelar, pelo
    // tempo de resposta, se o email existe.
    await fakeVerifyPassword();
    throw unauthorized("Email ou password incorrectos.");
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw unauthorized("Email ou password incorrectos.");
  if (!user.active) throw unauthorized("Esta conta foi desactivada.");

  return issueSession(user, meta);
}

/**
 * Rotação de refresh tokens: cada utilização invalida o token anterior e emite
 * um novo. Se um token já rodado voltar a aparecer, foi roubado — revogamos
 * toda a família de sessões desse utilizador.
 */
export async function refresh(rawToken: string, meta: SessionMeta): Promise<IssuedSession> {
  const tokenHash = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored) throw unauthorized("Sessão inválida.");

  if (stored.revokedAt) {
    logger.warn("Reutilização de refresh token detectada", { userId: stored.userId });
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthorized("Sessão comprometida. Inicia sessão novamente.");
  }

  if (stored.expiresAt.getTime() < Date.now()) throw unauthorized("Sessão expirada.");
  if (!stored.user.active) throw unauthorized("Esta conta foi desactivada.");

  const session = await issueSession(stored.user, meta);

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date(), replacedByHash: hashToken(session.refreshToken) },
  });

  return session;
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function logoutAll(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Devolve o token em claro apenas para o poder enviar por email. Em base fica
 * só o hash — quem lê a tabela não consegue repor a password de ninguém.
 *
 * Responde sempre com sucesso, mesmo para emails desconhecidos: caso contrário
 * este endpoint torna-se um oráculo de contas registadas.
 */
export async function requestPasswordReset(email: string): Promise<{ token: string } | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) return null;

  // Invalida pedidos anteriores ainda por usar.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const { token, hash } = generateOpaqueToken();
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hash,
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  return { token };
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw badRequest("Link de reposição inválido ou expirado.");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(newPassword) },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Repor a password termina todas as sessões abertas — é o comportamento
    // esperado por quem faz reposição exactamente por suspeitar de intrusão.
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("Conta não encontrada.");
  return toPublicUser(user);
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.marketingOptIn !== undefined ? { marketingOptIn: input.marketingOptIn } : {}),
    },
  });
  return toPublicUser(user);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("Conta não encontrada.");

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) throw unauthorized("A password actual está incorrecta.");

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
}

/** Estatísticas do cartão lateral em /conta. */
export async function getAccountStats(userId: string): Promise<{
  orders: number;
  wishlist: number;
  memberSince: string;
  totalSpent: number;
}> {
  const [user, orders, wishlist, spent] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.order.count({ where: { userId } }),
    prisma.wishlistItem.count({ where: { userId } }),
    prisma.order.aggregate({
      where: { userId, status: { notIn: ["CANCELADA"] } },
      _sum: { total: true },
    }),
  ]);

  if (!user) throw notFound("Conta não encontrada.");

  return {
    orders,
    wishlist,
    memberSince: user.createdAt.toISOString(),
    totalSpent: spent._sum.total ?? 0,
  };
}
