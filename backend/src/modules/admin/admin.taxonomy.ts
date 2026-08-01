import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { conflict, notFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { uniqueSlug } from "../../lib/slug.js";
import { validate } from "../../middleware/validate.js";
import { serializeBrand, serializeCategory } from "../catalog/catalog.serializer.js";
import { brandSchema, categorySchema, idParamSchema } from "./admin.schemas.js";

export const adminCategoriesRouter = Router();
export const adminBrandsRouter = Router();

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

// ─── Marcas ───────────────────────────────────────────────────────────────────

adminBrandsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.brand.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    });
    res.json({ brands: rows.map(serializeBrand) });
  }),
);

adminBrandsRouter.post(
  "/",
  validate({ body: brandSchema }),
  asyncHandler(async (req, res) => {
    const slug =
      req.body.slug ??
      (await uniqueSlug(req.body.name, async (candidate) =>
        Boolean(await prisma.brand.findUnique({ where: { slug: candidate } })),
      ));

    const brand = await prisma.brand.create({
      data: {
        name: req.body.name,
        slug,
        tagline: req.body.tagline ?? null,
        description: req.body.description ?? null,
        imageUrl: req.body.imageUrl ?? null,
        imagePublicId: req.body.imagePublicId ?? null,
        logoUrl: req.body.logoUrl ?? null,
        logoPublicId: req.body.logoPublicId ?? null,
        featured: req.body.featured,
        position: req.body.position,
        active: req.body.active,
      },
      include: { _count: { select: { products: true } } },
    });

    res.status(201).json({ brand: serializeBrand(brand) });
  }),
);

adminBrandsRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: brandSchema.partial() }),
  asyncHandler(async (req, res) => {
    const brand = await prisma.brand.update({
      where: { id: req.params.id! },
      data: req.body,
      include: { _count: { select: { products: true } } },
    });
    res.json({ brand: serializeBrand(brand) });
  }),
);

/**
 * Uma marca com produtos não pode ser removida: `Product.brandId` é obrigatório
 * e apagá-la deixaria peças órfãs. Damos a razão em vez de devolver um erro de
 * chave estrangeira.
 */
adminBrandsRouter.delete(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const brand = await prisma.brand.findUnique({
      where: { id: req.params.id! },
      include: { _count: { select: { products: true } } },
    });
    if (!brand) throw notFound("Marca não encontrada.");

    if (brand._count.products > 0) {
      // Desactivar retira-a da loja sem partir o catálogo.
      await prisma.brand.update({ where: { id: brand.id }, data: { active: false } });
      res.json({
        deleted: false,
        archived: true,
        message: `Marca desactivada: tem ${brand._count.products} produto(s) associado(s).`,
      });
      return;
    }

    await prisma.brand.delete({ where: { id: brand.id } });
    res.json({ deleted: true, archived: false });
  }),
);
