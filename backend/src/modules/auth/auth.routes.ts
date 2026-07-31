import { Router } from "express";

import { env } from "../../config/env.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { clearSessionCookies, setSessionCookies } from "../../lib/cookies.js";
import { unauthorized } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { authenticate, REFRESH_COOKIE } from "../../middleware/auth.js";
import { authLimiter, passwordResetLimiter } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { mergeGuestCartIntoUser } from "../cart/cart.service.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "./auth.schemas.js";
import * as service from "./auth.service.js";

export const authRouter = Router();

function sessionMeta(req: Parameters<typeof authenticate>[0]) {
  return {
    userAgent: req.get("user-agent") ?? undefined,
    ip: req.ip ?? undefined,
  };
}

authRouter.post(
  "/register",
  authLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const session = await service.register(req.body, sessionMeta(req));
    setSessionCookies(res, session);
    // O carrinho montado antes do registo tem de sobreviver à criação da conta.
    await mergeGuestCartIntoUser(req, session.user.id);
    res.status(201).json({ user: session.user, accessToken: session.accessToken });
  }),
);

authRouter.post(
  "/login",
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const session = await service.login(req.body.email, req.body.password, sessionMeta(req));
    setSessionCookies(res, session);
    await mergeGuestCartIntoUser(req, session.user.id);
    res.json({ user: session.user, accessToken: session.accessToken });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const cookies = req.cookies as Record<string, string> | undefined;
    const token = cookies?.[REFRESH_COOKIE];
    if (!token) throw unauthorized("Sessão inválida.");

    const session = await service.refresh(token, sessionMeta(req));
    setSessionCookies(res, session);
    res.json({ user: session.user, accessToken: session.accessToken });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const cookies = req.cookies as Record<string, string> | undefined;
    await service.logout(cookies?.[REFRESH_COOKIE]);
    clearSessionCookies(res);
    res.status(204).end();
  }),
);

authRouter.post(
  "/logout-all",
  authenticate,
  asyncHandler(async (req, res) => {
    await service.logoutAll(req.auth!.userId);
    clearSessionCookies(res);
    res.status(204).end();
  }),
);

authRouter.post(
  "/forgot-password",
  passwordResetLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.requestPasswordReset(req.body.email);

    if (result) {
      const link = `${env.PUBLIC_SITE_URL}/repor-password?token=${result.token}`;
      // PENDENTE DE CONFIGURAÇÃO: sem provedor de email (Resend/SendGrid/SMTP)
      // configurado, registamos o link em vez de o enviar. Ver relatório final.
      logger.info("Link de reposição de password gerado", {
        email: req.body.email,
        link: env.isProduction ? "[oculto]" : link,
      });
    }

    // Resposta idêntica exista ou não a conta — não confirmamos emails registados.
    res.json({
      message: "Se existir uma conta com este email, enviámos as instruções de reposição.",
      // Em desenvolvimento devolvemos o token para permitir testar o fluxo completo.
      ...(env.isDevelopment && result ? { devToken: result.token } : {}),
    });
  }),
);

authRouter.post(
  "/reset-password",
  passwordResetLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(async (req, res) => {
    await service.resetPassword(req.body.token, req.body.password);
    clearSessionCookies(res);
    res.json({ message: "Password actualizada. Já podes iniciar sessão." });
  }),
);

authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await service.getProfile(req.auth!.userId);
    res.json({ user });
  }),
);

authRouter.patch(
  "/me",
  authenticate,
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req, res) => {
    const user = await service.updateProfile(req.auth!.userId, req.body);
    res.json({ user });
  }),
);

authRouter.post(
  "/me/password",
  authenticate,
  authLimiter,
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req, res) => {
    await service.changePassword(
      req.auth!.userId,
      req.body.currentPassword,
      req.body.newPassword,
    );
    res.json({ message: "Password actualizada." });
  }),
);

authRouter.get(
  "/me/stats",
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ stats: await service.getAccountStats(req.auth!.userId) });
  }),
);
