import { z } from "zod";

/**
 * `?category=Hoodies&category=Denim` chega como array, mas `?category=Hoodies`
 * chega como string. Normalizamos para array em ambos os casos — sem isto o
 * filtro parte silenciosamente quando há uma só selecção.
 */
const csvArray = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    const list = Array.isArray(value) ? value : value.split(",");
    const cleaned = list.map((v) => v.trim()).filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  });

const boolish = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => (typeof v === "string" ? v === "true" || v === "1" : v));

export const productQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: csvArray,
  collection: z.string().trim().max(120).optional(),
  size: csvArray,
  color: csvArray,
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  inStock: boolish,
  isNew: boolish,
  isDrop: boolish,
  bestSeller: boolish,
  sort: z.enum(["novidades", "preco-asc", "preco-desc", "nome"]).default("novidades"),
  page: z.coerce.number().int().positive().default(1),
  // Tecto de 60 para que ninguém consiga exportar o catálogo inteiro num pedido.
  pageSize: z.coerce.number().int().positive().max(60).default(24),
});

export const slugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(140)
    .regex(/^[a-z0-9-]+$/i, "Slug inválido."),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  limit: z.coerce.number().int().positive().max(12).default(6),
});

export type ProductQuery = z.infer<typeof productQuerySchema>;
