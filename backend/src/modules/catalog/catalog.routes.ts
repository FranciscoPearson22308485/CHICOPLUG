import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { validate } from "../../middleware/validate.js";
import { productQuerySchema, searchQuerySchema, slugParamSchema } from "./catalog.schemas.js";
import * as service from "./catalog.service.js";

export const catalogRouter = Router();

// Catálogo é público e imutável entre alterações do admin: 60s de cache no
// browser e 5min no CDN cobrem picos de tráfego de um drop sem servir dados velhos.
const publicCache = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

catalogRouter.get(
  "/products",
  validate({ query: productQuerySchema }),
  asyncHandler(async (req, res) => {
    const result = await service.listProducts(req.query as never);
    res.set("Cache-Control", publicCache);
    res.json(result);
  }),
);

catalogRouter.get(
  "/products/search",
  validate({ query: searchQuerySchema }),
  asyncHandler(async (req, res) => {
    const { q, limit } = req.query as unknown as { q: string; limit: number };
    res.json(await service.searchSuggestions(q, limit));
  }),
);

catalogRouter.get(
  "/products/:slug",
  validate({ params: slugParamSchema }),
  asyncHandler(async (req, res) => {
    const product = await service.getProductBySlug(req.params.slug!);
    res.set("Cache-Control", publicCache);
    res.json({ product });
  }),
);

catalogRouter.get(
  "/products/:slug/related",
  validate({ params: slugParamSchema }),
  asyncHandler(async (req, res) => {
    res.set("Cache-Control", publicCache);
    res.json({ products: await service.getRelatedProducts(req.params.slug!) });
  }),
);

catalogRouter.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    res.set("Cache-Control", publicCache);
    res.json({ categories: await service.listCategories() });
  }),
);

catalogRouter.get(
  "/brands",
  asyncHandler(async (req, res) => {
    const featuredOnly = req.query["featured"] === "true";
    res.set("Cache-Control", publicCache);
    res.json({ brands: await service.listBrands({ featuredOnly }) });
  }),
);

catalogRouter.get(
  "/brands/:slug",
  validate({ params: slugParamSchema }),
  asyncHandler(async (req, res) => {
    res.set("Cache-Control", publicCache);
    res.json(await service.getBrandBySlug(req.params.slug!));
  }),
);

catalogRouter.get(
  "/promotions",
  asyncHandler(async (_req, res) => {
    res.set("Cache-Control", publicCache);
    res.json({ products: await service.listPromotions(12) });
  }),
);

catalogRouter.get(
  "/home",
  asyncHandler(async (_req, res) => {
    res.set("Cache-Control", publicCache);
    res.json(await service.getHomeFeed());
  }),
);

catalogRouter.get(
  "/facets",
  asyncHandler(async (_req, res) => {
    res.set("Cache-Control", publicCache);
    res.json({ facets: await service.getFacets() });
  }),
);
