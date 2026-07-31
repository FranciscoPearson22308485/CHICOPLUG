import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../../lib/async-handler.js";
import { optionalAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as service from "./cart.service.js";

export const cartRouter = Router();

// O carrinho funciona com e sem conta.
cartRouter.use(optionalAuth);

const addItemSchema = z.object({
  variantId: z.string().min(1, "Variante em falta."),
  quantity: z.coerce.number().int().positive().max(20).default(1),
});

const updateItemSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(20),
});

const itemParamSchema = z.object({ itemId: z.string().min(1) });

cartRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const cart = await service.resolveCart(req, res);
    res.json({ cart: service.serializeCart(cart) });
  }),
);

cartRouter.post(
  "/items",
  validate({ body: addItemSchema }),
  asyncHandler(async (req, res) => {
    const cart = await service.resolveCart(req, res);
    const updated = await service.addItem(cart, req.body.variantId, req.body.quantity);
    res.status(201).json({ cart: service.serializeCart(updated) });
  }),
);

cartRouter.patch(
  "/items/:itemId",
  validate({ params: itemParamSchema, body: updateItemSchema }),
  asyncHandler(async (req, res) => {
    const cart = await service.resolveCart(req, res);
    const updated = await service.updateItemQuantity(cart, req.params.itemId!, req.body.quantity);
    res.json({ cart: service.serializeCart(updated) });
  }),
);

cartRouter.delete(
  "/items/:itemId",
  validate({ params: itemParamSchema }),
  asyncHandler(async (req, res) => {
    const cart = await service.resolveCart(req, res);
    const updated = await service.removeItem(cart, req.params.itemId!);
    res.json({ cart: service.serializeCart(updated) });
  }),
);

cartRouter.delete(
  "/",
  asyncHandler(async (req, res) => {
    const cart = await service.resolveCart(req, res);
    const updated = await service.clearCart(cart.id);
    res.json({ cart: service.serializeCart(updated) });
  }),
);

/** Revalidação de stock, chamada à entrada do checkout. */
cartRouter.get(
  "/validate",
  asyncHandler(async (req, res) => {
    const cart = await service.resolveCart(req, res);
    const issues = await service.validateCartStock(cart);
    res.json({ valid: issues.length === 0, issues, cart: service.serializeCart(cart) });
  }),
);
