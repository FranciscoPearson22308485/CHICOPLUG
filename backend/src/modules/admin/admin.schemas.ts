import { z } from "zod";

export const idParamSchema = z.object({ id: z.string().min(1) });

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().trim().max(120).optional(),
});

// ─── Produtos ─────────────────────────────────────────────────────────────────

export const variantInputSchema = z.object({
  id: z.string().optional(),
  size: z.string().trim().min(1, "Indica o tamanho.").max(20),
  colorName: z.string().trim().min(1, "Indica a cor.").max(40),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor tem de estar no formato #RRGGBB."),
  stock: z.coerce.number().int().min(0).max(100000).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).max(1000).default(6),
  priceOverride: z.coerce.number().int().positive().nullable().optional(),
  active: z.boolean().default(true),
});

export const imageInputSchema = z.object({
  url: z.string().trim().min(1),
  publicId: z.string().trim().nullable().optional(),
  alt: z.string().trim().max(200).nullable().optional(),
  width: z.coerce.number().int().positive().nullable().optional(),
  height: z.coerce.number().int().positive().nullable().optional(),
});

const productBaseSchema = z.object({
  name: z.string().trim().min(1, "Indica o nome da peça.").max(140),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Slug inválido.")
    .optional(),
  description: z.string().trim().min(1, "Escreve uma descrição.").max(4000),
  details: z.array(z.string().trim().max(200)).max(20).default([]),

  price: z.coerce.number().int().positive("O preço tem de ser positivo."),
  compareAt: z.coerce.number().int().positive().nullable().optional(),

  categoryId: z.string().min(1, "Escolhe a categoria."),
  brandId: z.string().min(1, "Escolhe a marca."),

  badge: z.enum(["NOVO", "DROP", "ESGOTADO", "ULTIMAS_UNIDADES"]).nullable().optional(),
  isNew: z.boolean().default(false),
  isDrop: z.boolean().default(false),
  bestSeller: z.boolean().default(false),
  active: z.boolean().default(true),

  metaTitle: z.string().trim().max(160).nullable().optional(),
  metaDescription: z.string().trim().max(320).nullable().optional(),

  images: z.array(imageInputSchema).max(10).default([]),
  variants: z.array(variantInputSchema).min(1, "Cria pelo menos uma variante.").max(60),
});

export const createProductSchema = productBaseSchema.refine(
  (data) => data.compareAt == null || data.compareAt > data.price,
  // Um "preço antes" abaixo do actual mostraria um desconto negativo na UI.
  { message: "O preço comparativo tem de ser superior ao preço actual.", path: ["compareAt"] },
);

// A actualização é parcial, por isso a comparação preço/compareAt não pode ser
// feita aqui — pode chegar só um dos dois. A verificação vive no handler, que
// conhece os valores actualmente guardados.
export const updateProductSchema = productBaseSchema.partial();

export type ProductInput = z.infer<typeof productBaseSchema>;

// ─── Categorias e colecções ───────────────────────────────────────────────────

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Indica o nome.").max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().trim().max(500).nullable().optional(),
  position: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const brandSchema = z.object({
  name: z.string().trim().min(1, "Indica o nome da marca.").max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  tagline: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  imageUrl: z.string().trim().nullable().optional(),
  imagePublicId: z.string().trim().nullable().optional(),
  logoUrl: z.string().trim().nullable().optional(),
  logoPublicId: z.string().trim().nullable().optional(),
  /** Destaca a marca na secção "Marcas Populares" da homepage. */
  featured: z.boolean().default(false),
  position: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

// ─── Clientes ─────────────────────────────────────────────────────────────────

export const updateCustomerSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  active: z.boolean().optional(),
  marketingOptIn: z.boolean().optional(),
});

// ─── Encomendas ───────────────────────────────────────────────────────────────

export const orderStatusSchema = z.object({
  status: z.enum(["NOVA", "CONFIRMADA", "EM_PREPARACAO", "ENVIADA", "ENTREGUE", "CANCELADA"]),
  note: z.string().trim().max(500).optional(),
});

export const orderListSchema = paginationSchema.extend({
  status: z
    .enum(["NOVA", "CONFIRMADA", "EM_PREPARACAO", "ENVIADA", "ENTREGUE", "CANCELADA"])
    .optional(),
});

// ─── Stock ────────────────────────────────────────────────────────────────────

export const stockAdjustSchema = z.object({
  adjustments: z
    .array(
      z.object({
        variantId: z.string().min(1),
        /** Valor absoluto quando `mode = "set"`, delta quando `mode = "delta"`. */
        quantity: z.coerce.number().int(),
        mode: z.enum(["set", "delta"]).default("set"),
      }),
    )
    .min(1)
    .max(200),
});

export const stockListSchema = paginationSchema.extend({
  lowOnly: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => (typeof v === "string" ? v === "true" || v === "1" : v)),
});

// ─── Cupões ───────────────────────────────────────────────────────────────────

const couponBaseSchema = z.object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "O código precisa de pelo menos 3 caracteres.")
      .max(40)
      .regex(/^[A-Z0-9_-]+$/, "Usa apenas letras, números, hífen e underscore."),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.coerce.number().int().positive(),
    minSubtotal: z.coerce.number().int().min(0).nullable().optional(),
    maxRedemptions: z.coerce.number().int().positive().nullable().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    active: z.boolean().default(true),
});

export const couponSchema = couponBaseSchema
  .refine((data) => data.type !== "PERCENT" || data.value <= 100, {
    message: "Uma percentagem não pode exceder 100.",
    path: ["value"],
  })
  .refine((data) => !data.startsAt || !data.endsAt || data.endsAt > data.startsAt, {
    message: "A data de fim tem de ser posterior à de início.",
    path: ["endsAt"],
  });

export const updateCouponSchema = couponBaseSchema.partial();

// ─── Definições ───────────────────────────────────────────────────────────────

export const settingsSchema = z.object({
  storeName: z.string().trim().min(1).max(120).optional(),
  contactEmail: z.string().trim().email().optional(),
  shippingFlatRate: z.coerce.number().int().min(0).optional(),
  freeShippingThreshold: z.coerce.number().int().min(0).optional(),
  storeActive: z.boolean().optional(),
  multicaixaEnabled: z.boolean().optional(),
  freeShippingEnabled: z.boolean().optional(),
  dropWaitlistEnabled: z.boolean().optional(),
});
