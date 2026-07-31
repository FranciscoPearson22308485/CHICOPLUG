import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../../lib/async-handler.js";
import { notFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { productInclude, serializeProduct } from "../catalog/catalog.serializer.js";

export const wishlistRouter = Router();

wishlistRouter.use(authenticate);

const productIdSchema = z.object({ productId: z.string().min(1) });

wishlistRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.auth!.userId },
      orderBy: { createdAt: "desc" },
      include: { product: { include: productInclude } },
    });

    res.json({
      products: items.filter((i) => i.product.active).map((i) => serializeProduct(i.product)),
    });
  }),
);

/** Devolve só os IDs — permite ao ProductCard pintar o coração sem carregar tudo. */
wishlistRouter.get(
  "/ids",
  asyncHandler(async (req, res) => {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.auth!.userId },
      select: { productId: true },
    });
    res.json({ productIds: items.map((i) => i.productId) });
  }),
);

wishlistRouter.post(
  "/",
  validate({ body: productIdSchema }),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: req.body.productId, active: true },
      select: { id: true },
    });
    if (!product) throw notFound("Peça não encontrada.");

    await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: req.auth!.userId, productId: product.id } },
      create: { userId: req.auth!.userId, productId: product.id },
      update: {},
    });

    res.status(201).json({ added: true, productId: product.id });
  }),
);

wishlistRouter.delete(
  "/:productId",
  validate({ params: productIdSchema }),
  asyncHandler(async (req, res) => {
    await prisma.wishlistItem.deleteMany({
      where: { userId: req.auth!.userId, productId: req.params.productId! },
    });
    res.json({ added: false, productId: req.params.productId });
  }),
);

/** Alterna o estado — é o que o coração do ProductCard precisa. */
wishlistRouter.post(
  "/toggle",
  validate({ body: productIdSchema }),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const existing = await prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId: req.body.productId } },
    });

    if (existing) {
      await prisma.wishlistItem.delete({ where: { id: existing.id } });
      res.json({ added: false, productId: req.body.productId });
      return;
    }

    const product = await prisma.product.findFirst({
      where: { id: req.body.productId, active: true },
      select: { id: true },
    });
    if (!product) throw notFound("Peça não encontrada.");

    await prisma.wishlistItem.create({ data: { userId, productId: product.id } });
    res.status(201).json({ added: true, productId: product.id });
  }),
);
