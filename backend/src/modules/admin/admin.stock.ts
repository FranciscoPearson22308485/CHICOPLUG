import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { badRequest } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { validate } from "../../middleware/validate.js";
import { stockAdjustSchema, stockListSchema } from "./admin.schemas.js";

export const adminStockRouter = Router();

/** Inventário ao nível da variante — é onde o stock vive de facto. */
adminStockRouter.get(
  "/",
  validate({ query: stockListSchema }),
  asyncHandler(async (req, res) => {
    const { page, pageSize, search, lowOnly } = req.query as unknown as {
      page: number;
      pageSize: number;
      search?: string;
      lowOnly?: boolean;
    };

    const where = {
      active: true,
      ...(search
        ? {
            OR: [
              { sku: { contains: search, mode: "insensitive" as const } },
              { product: { name: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.productVariant.findMany({
        where,
        include: { product: { select: { id: true, name: true, slug: true } } },
        orderBy: [{ stock: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.productVariant.count({ where }),
    ]);

    // O filtro "abaixo do limiar" compara duas colunas da mesma linha, o que o
    // Prisma ainda não exprime em `where` — filtramos após a consulta.
    const mapped = rows
      .map((variant) => ({
        id: variant.id,
        productId: variant.product.id,
        productName: variant.product.name,
        productSlug: variant.product.slug,
        sku: variant.sku,
        size: variant.size,
        colorName: variant.colorName,
        colorHex: variant.colorHex,
        stock: variant.stock,
        lowStockThreshold: variant.lowStockThreshold,
        status:
          variant.stock === 0
            ? ("SEM_STOCK" as const)
            : variant.stock <= variant.lowStockThreshold
              ? ("CRITICO" as const)
              : ("OK" as const),
      }))
      .filter((v) => (lowOnly ? v.status !== "OK" : true));

    res.json({
      variants: mapped,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  }),
);

/** Alertas de stock baixo — alimentam o cartão "Stock crítico" do dashboard. */
adminStockRouter.get(
  "/alerts",
  asyncHandler(async (_req, res) => {
    const variants = await prisma.productVariant.findMany({
      where: { active: true, product: { active: true } },
      include: { product: { select: { id: true, name: true, slug: true } } },
      orderBy: { stock: "asc" },
      take: 200,
    });

    const alerts = variants
      .filter((v) => v.stock <= v.lowStockThreshold)
      .map((v) => ({
        variantId: v.id,
        productId: v.product.id,
        productName: v.product.name,
        productSlug: v.product.slug,
        sku: v.sku,
        size: v.size,
        colorName: v.colorName,
        stock: v.stock,
        threshold: v.lowStockThreshold,
        severity: v.stock === 0 ? ("SEM_STOCK" as const) : ("CRITICO" as const),
      }));

    res.json({
      alerts,
      outOfStock: alerts.filter((a) => a.severity === "SEM_STOCK").length,
      critical: alerts.filter((a) => a.severity === "CRITICO").length,
    });
  }),
);

/**
 * Ajuste de stock em lote. `set` define o valor absoluto; `delta` soma ou
 * subtrai — o modo delta é o correcto para receber mercadoria sem apagar vendas
 * ocorridas entre abrir o formulário e submetê-lo.
 */
adminStockRouter.post(
  "/adjust",
  validate({ body: stockAdjustSchema }),
  asyncHandler(async (req, res) => {
    const { adjustments } = req.body as {
      adjustments: Array<{ variantId: string; quantity: number; mode: "set" | "delta" }>;
    };

    const updated = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const adjustment of adjustments) {
        const variant = await tx.productVariant.findUnique({
          where: { id: adjustment.variantId },
        });
        if (!variant) throw badRequest(`Variante inexistente: ${adjustment.variantId}`);

        const next =
          adjustment.mode === "set" ? adjustment.quantity : variant.stock + adjustment.quantity;

        if (next < 0) {
          throw badRequest(
            `O ajuste deixaria ${variant.sku} com stock negativo (${next}).`,
          );
        }

        const saved = await tx.productVariant.update({
          where: { id: variant.id },
          data: { stock: next },
        });

        results.push({ variantId: saved.id, sku: saved.sku, from: variant.stock, to: saved.stock });
      }

      return results;
    });

    res.json({ adjustments: updated });
  }),
);
