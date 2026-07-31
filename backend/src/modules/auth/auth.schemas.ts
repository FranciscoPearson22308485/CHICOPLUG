import { z } from "zod";

/**
 * Política de password: comprimento é o factor que mais pesa na resistência a
 * força bruta, por isso exigimos 8+ com letra e número em vez de um cardápio de
 * símbolos obrigatórios que só empurra as pessoas para "Password1!".
 */
const password = z
  .string()
  .min(8, "A password precisa de pelo menos 8 caracteres.")
  .max(128, "A password é demasiado longa.")
  .refine((v) => /[a-zA-Z]/.test(v), "A password precisa de pelo menos uma letra.")
  .refine((v) => /[0-9]/.test(v), "A password precisa de pelo menos um número.");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email inválido.")
  .max(254, "Email demasiado longo.");

/** Aceita "+244 900 000 000", "900000000" e variantes com separadores. */
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s().-]{9,20}$/, "Telefone inválido.")
  .transform((v) => v.replace(/[\s().-]/g, ""));

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, "Indica o teu nome.").max(60),
  lastName: z.string().trim().min(1, "Indica o teu apelido.").max(60),
  email,
  password,
  phone: phone.optional(),
  marketingOptIn: z.boolean().optional().default(true),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Indica a password."),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token em falta."),
  password,
});

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  phone: phone.optional().nullable(),
  marketingOptIn: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Indica a password actual."),
  newPassword: password,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
