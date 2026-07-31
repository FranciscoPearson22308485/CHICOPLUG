import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { conflict, notFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { uniqueSlug } from "../../lib/slug.js";
import { validate } from "../../middleware/validate.js";
import { serializeCategory, serializeCollection } from "../catalog/catalog.serializer.js";
import { categorySchema, collectionSchema, idParamSchema } from "./admin.schemas.js";

export const adminCategoriesRouter = Router();
export const adminCollectionsRouter = Router();

// ─── Categorias ───────────────────────────────────────────────────────────────

adminCategoriesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.category.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    });
    res.json({ categories: rows.map(serializeCategory) });
  }),
);

adminCategoriesRouter.post(
  "/",
  validate({ body: categorySchema }),
  asyncHandler(async (req, res) => {
    const slug =
      req.body.slug ??
      (await uniqueSlug(req.body.name, async (candidate) =>
        Boolean(await prisma.category.findUnique({ where: { slug: candidate } })),
      ));

    const category = await prisma.category.create({
      data: {
        name: req.body.name,
        slug,
        description: req.body.description ?? null,
        position: req.body.position,
        active: req.body.active,
      },
      include: { _count: { select: { products: true } } },
    });

    res.status(201).json({ category: serializeCategory(category) });
  }),
);

adminCategoriesRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: categorySchema.partial() }),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.update({
      where: { id: req.params.id! },
      data: req.body,
      include: { _count: { select: { products: true } } },
    });
    res.json({ category: serializeCategory(category) });
  }),
);

/**
 * Uma categoria com produtos não pode ser removida: `Product.categoryId` é
 * obrigatório, e apagá-la deixaria os produtos órfãos. Damos a razão em vez de
 * devolver um erro de chave estrangeira.
 */
adminCategoriesRouter.delete(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.findUnique({
      where: { id: req.params.id! },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw notFound("Categoria não encontrada.");

    if (category._count.products > 0) {
      throw conflict(
        `Esta categoria tem ${category._count.products} produto(s). ` +
          "Move-os para outra categoria antes de a remover.",
      );
    }

    await prisma.category.delete({ where: { id: category.id } });
    res.status(204).end();
  }),
);

// ─── Colecções ────────────────────────────────────────────────────────────────

adminCollectionsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.collection.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    });
    res.json({ collections: rows.map(serializeCollection) });
  }),
);

adminCollectionsRouter.post(
  "/",
  validate({ body: collectionSchema }),
  asyncHandler(async (req, res) => {
    const slug =
      req.body.slug ??
      (await uniqueSlug(req.body.name, async (candidate) =>
        Boolean(await prisma.collection.findUnique({ where: { slug: candidate } })),
      ));

    const collection = await prisma.collection.create({
      data: {
        name: req.body.name,
        slug,
        season: req.body.season,
        description: req.body.description ?? null,
        imageUrl: req.body.imageUrl ?? null,
        imagePublicId: req.body.imagePublicId ?? null,
        position: req.body.position,
        active: req.body.active,
      },
      include: { _count: { select: { products: true } } },
    });

    res.status(201).json({ collection: serializeCollection(collection) });
  }),
);

adminCollectionsRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: collectionSchema.partial() }),
  asyncHandler(async (req, res) => {
    const collection = await prisma.collection.update({
      where: { id: req.params.id! },
      data: req.body,
      include: { _count: { select: { products: true } } },
    });
    res.json({ collection: serializeCollection(collection) });
  }),
);

/** Aqui podemos apagar: `Product.collectionId` é opcional e fica a NULL. */
adminCollectionsRouter.delete(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await prisma.collection.delete({ where: { id: req.params.id! } });
    res.status(204).end();
  }),
);
