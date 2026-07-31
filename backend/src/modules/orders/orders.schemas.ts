import { z } from "zod";

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(1, "Indica o nome completo.").max(120),
  email: z.string().trim().toLowerCase().email("Email inválido."),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s().-]{9,20}$/, "Telefone inválido."),

  province: z.string().trim().min(1, "Escolhe a província.").max(60),
  municipality: z.string().trim().min(1, "Escolhe o município.").max(60),
  street: z.string().trim().min(1, "Indica a morada.").max(240),
  notes: z.string().trim().max(500).optional(),

  couponCode: z.string().trim().max(40).optional(),

  /** Guarda esta morada no perfil (ignorado em compras sem conta). */
  saveAddress: z.boolean().optional().default(false),
});

export const referenceParamSchema = z.object({
  reference: z
    .string()
    .trim()
    .regex(/^CP-\d+$/i, "Referência inválida."),
});

export const guestLookupSchema = z.object({
  reference: z
    .string()
    .trim()
    .regex(/^CP-\d+$/i, "Referência inválida."),
  email: z.string().trim().toLowerCase().email("Email inválido."),
});

export const couponPreviewSchema = z.object({
  code: z.string().trim().min(1, "Indica o código.").max(40),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
