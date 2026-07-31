import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { buildSku, uniqueSlug } from "../../lib/slug.js";
import { validate } from "../../middleware/validate.js";
import { productInclude, serializeProduct } from "../catalog/catalog.serializer.js";
import { deleteImage } from "../uploads/storage.js";
import {
  createProductSchema,
  idParamSchema,
  paginationSchema,
  updateProductSchema,
} from "./admin.schemas.js";

export const adminProductsRouter = Router();

const slugExists = (excludeId?: string) => async (slug: string) => {
  const found = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  return Boolean(found && found.id !== excludeId);
};

/** Lista para a tabela do admin — inclui inactivos, ao contrário da loja. */
adminProductsRouter.get(
  "/",
  validate({ query: paginationSchema }),
  asyncHandler(async (req, res) => {
    const { page, pageSize, search } = req.query as unknown as {
      page: number;
      pageSize: number;
      search?: string;
    };

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { slug: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products: rows.map(serializeProduct),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  }),
);

adminProductsRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id! },
      include: productInclude,
    });
    if (!product) throw notFound("Produto não encontrado.");
    res.json({ product: serializeProduct(product) });
  }),
);

adminProductsRouter.post(
  "/",
  validate({ body: createProductSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as import("zod").infer<typeof createProductSchema>;

    const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
    if (!category) throw badRequest("Categoria inexistente.");

    if (body.collectionId) {
      const collection = await prisma.collection.findUnique({ where: { id: body.collectionId } });
      if (!collection) throw badRequest("Colecção inexistente.");
    }

    // Duas variantes com o mesmo (tamanho, cor) violariam a chave única — vale
    // a pena dizer isso claramente em vez de deixar rebentar no Postgres.
    const seen = new Set<string>();
    for (const variant of body.variants) {
      const key = `${variant.size}|${variant.colorName}`;
      if (seen.has(key)) {
        throw conflict(`Variante duplicada: ${variant.size} / ${variant.colorName}.`);
      }
      seen.add(key);
    }

    const slug = body.slug ?? (await uniqueSlug(body.name, slugExists()));

    const product = await prisma.product.create({
      data: {
        slug,
        name: body.name,
        description: body.description,
        details: body.details,
        price: body.price,
        compareAt: body.compareAt ?? null,
        categoryId: body.categoryId,
        collectionId: body.collectionId ?? null,
        badge: body.badge ?? null,
        isNew: body.isNew,
        isDrop: body.isDrop,
        bestSeller: body.bestSeller,
        active: body.active,
        metaTitle: body.metaTitle ?? null,
        metaDescription: body.metaDescription ?? null,
        images: {
          create: body.images.map((image, index) => ({
            url: image.url,
            publicId: image.publicId ?? null,
            alt: image.alt ?? body.name,
            position: index,
            width: image.width ?? null,
            height: image.height ?? null,
          })),
        },
        variants: {
          create: body.variants.map((variant) => ({
            size: variant.size,
            colorName: variant.colorName,
            colorHex: variant.colorHex,
            sku: `${buildSku(body.name, variant.size, variant.colorName)}-${Math.random()
              .toString(36)
              .slice(2, 6)
              .toUpperCase()}`,
            stock: variant.stock,
            lowStockThreshold: variant.lowStockThreshold,
            priceOverride: variant.priceOverride ?? null,
            active: variant.active,
          })),
        },
      },
      include: productInclude,
    });

    res.status(201).json({ product: serializeProduct(product) });
  }),
);

/**
 * Actualização. As variantes são reconciliadas por id: as enviadas com id são
 * actualizadas, as novas criadas, e as omitidas **desactivadas** em vez de
 * apagadas — apagá-las quebraria as linhas de encomendas antigas que lhes
 * apontam.
 */
adminProductsRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateProductSchema }),
  asyncHandler(async (req, res) => {
    const id = req.params.id!;
    const body = req.body as Partial<import("zod").infer<typeof createProductSchema>>;

    const existing = await prisma.product.findUnique({
      where: { id },
      include: { variants: true, images: true },
    });
    if (!existing) throw notFound("Produto não encontrado.");

    if (body.compareAt != null && (body.price ?? existing.price) >= body.compareAt) {
      throw badRequest("O preço comparativo tem de ser superior ao preço actual.");
    }

    const slug =
      body.slug ??
      (body.name && body.name !== existing.name
        ? await uniqueSlug(body.name, slugExists(id))
        : undefined);

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(slug ? { slug } : {}),
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.details !== undefined ? { details: body.details } : {}),
          ...(body.price !== undefined ? { price: body.price } : {}),
          ...(body.compareAt !== undefined ? { compareAt: body.compareAt } : {}),
          ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
          ...(body.collectionId !== undefined ? { collectionId: body.collectionId } : {}),
          ...(body.badge !== undefined ? { badge: body.badge } : {}),
          ...(body.isNew !== undefined ? { isNew: body.isNew } : {}),
          ...(body.isDrop !== undefined ? { isDrop: body.isDrop } : {}),
          ...(body.bestSeller !== undefined ? { bestSeller: body.bestSeller } : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
          ...(body.metaTitle !== undefined ? { metaTitle: body.metaTitle } : {}),
          ...(body.metaDescription !== undefined
            ? { metaDescription: body.metaDescription }
            : {}),
        },
      });

      if (body.images) {
        // Imagens podem ser substituídas em bloco: não há referências externas.
        const removed = existing.images.filter(
          (image) => !body.images!.some((incoming) => incoming.url === image.url),
        );
        await tx.productImage.deleteMany({ where: { productId: id } });
        await tx.productImage.createMany({
          data: body.images.map((image, index) => ({
            productId: id,
            url: image.url,
            publicId: image.publicId ?? null,
            alt: image.alt ?? body.name ?? existing.name,
            position: index,
            width: image.width ?? null,
            height: image.height ?? null,
          })),
        });
        // Limpeza dos ficheiros remotos fora da transacção lógica de dados.
        void Promise.all(removed.map((image) => deleteImage(image.publicId)));
      }

      if (body.variants) {
        const incomingIds = new Set(body.variants.map((v) => v.id).filter(Boolean));

        for (const variant of existing.variants) {
          if (!incomingIds.has(variant.id)) {
            await tx.productVariant.update({
              where: { id: variant.id },
              data: { active: false },
            });
          }
        }

        for (const variant of body.variants) {
          if (variant.id) {
            await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                size: variant.size,
                colorName: variant.colorName,
                colorHex: variant.colorHex,
                stock: variant.stock,
                lowStockThreshold: variant.lowStockThreshold,
                priceOverride: variant.priceOverride ?? null,
                active: variant.active,
              },
            });
          } else {
            await tx.productVariant.create({
              data: {
                productId: id,
                size: variant.size,
                colorName: variant.colorName,
                colorHex: variant.colorHex,
                sku: `${buildSku(
                  body.name ?? existing.name,
                  variant.size,
                  variant.colorName,
                )}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
                stock: variant.stock,
                lowStockThreshold: variant.lowStockThreshold,
                priceOverride: variant.priceOverride ?? null,
                active: variant.active,
              },
            });
          }
        }
      }
    });

    const product = await prisma.product.findUniqueOrThrow({
      where: { id },
      include: productInclude,
    });
    res.json({ product: serializeProduct(product) });
  }),
);

/**
 * Remoção. Produtos já vendidos são **arquivados** (active = false) em vez de
 * apagados: apagá-los deixaria encomendas históricas sem referência e falsearia
 * os relatórios.
 */
adminProductsRouter.delete(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const id = req.params.id!;
    const product = await prisma.product.findUnique({
      where: { id },
      include: { images: true, variants: { include: { orderItems: { take: 1 } } } },
    });
    if (!product) throw notFound("Produto não encontrado.");

    const hasSales = product.variants.some((variant) => variant.orderItems.length > 0);

    if (hasSales) {
      await prisma.product.update({ where: { id }, data: { active: false } });
      res.json({
        deleted: false,
        archived: true,
        message: "Produto arquivado: tem encomendas associadas e não pode ser removido.",
      });
      return;
    }

    await prisma.product.delete({ where: { id } });
    void Promise.all(product.images.map((image) => deleteImage(image.publicId)));

    res.json({ deleted: true, archived: false });
  }),
);
