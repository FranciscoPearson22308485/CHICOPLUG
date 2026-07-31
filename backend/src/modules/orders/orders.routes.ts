import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, optionalAuth } from "../../middleware/auth.js";
import { checkoutLimiter } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { resolveCart, serializeCart } from "../cart/cart.service.js";
import { createPaymentForOrder } from "../payments/payments.service.js";
import { evaluateCoupon } from "./coupons.js";
import {
  checkoutSchema,
  couponPreviewSchema,
  guestLookupSchema,
  referenceParamSchema,
} from "./orders.schemas.js";
import * as service from "./orders.service.js";

export const ordersRouter = Router();

/**
 * Checkout. Aceita compra com e sem conta — obrigar a registo antes de comprar
 * é uma das maiores causas de abandono de carrinho.
 */
ordersRouter.post(
  "/checkout",
  optionalAuth,
  checkoutLimiter,
  validate({ body: checkoutSchema }),
  asyncHandler(async (req, res) => {
    const order = await service.createOrderFromCart(req, res, req.body);

    // Inicia o pagamento imediatamente: a encomenda nasce com um pagamento
    // PENDENTE associado, que o frontend segue por polling.
    const payment = await createPaymentForOrder(order.reference);

    if (req.auth && req.body.saveAddress) {
      const userId = req.auth.userId;
      const count = await prisma.address.count({ where: { userId } });
      await prisma.address.create({
        data: {
          userId,
          label: "Entrega",
          recipientName: req.body.customerName,
          phone: req.body.phone,
          province: req.body.province,
          municipality: req.body.municipality,
          street: req.body.street,
          notes: req.body.notes ?? null,
          isDefault: count === 0,
        },
      });
    }

    res.status(201).json({ order, payment });
  }),
);

/** Pré-visualização do desconto antes de submeter o checkout. */
ordersRouter.post(
  "/coupons/preview",
  optionalAuth,
  validate({ body: couponPreviewSchema }),
  asyncHandler(async (req, res) => {
    const cart = serializeCart(await resolveCart(req, res));
    const { coupon, discount } = await evaluateCoupon(req.body.code, cart.subtotal);

    res.json({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discount,
      subtotal: cart.subtotal,
      total: Math.max(0, cart.subtotal - discount) + cart.shipping,
    });
  }),
);

/** Consulta de encomenda sem conta (referência + email). */
ordersRouter.post(
  "/lookup",
  validate({ body: guestLookupSchema }),
  asyncHandler(async (req, res) => {
    const order = await service.getGuestOrder(
      req.body.reference.toUpperCase(),
      req.body.email,
    );
    res.json({ order });
  }),
);

ordersRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ orders: await service.listUserOrders(req.auth!.userId) });
  }),
);

ordersRouter.get(
  "/:reference",
  authenticate,
  validate({ params: referenceParamSchema }),
  asyncHandler(async (req, res) => {
    const order = await service.getUserOrder(
      req.auth!.userId,
      req.params.reference!.toUpperCase(),
    );
    res.json({ order });
  }),
);

ordersRouter.post(
  "/:reference/cancel",
  authenticate,
  validate({ params: referenceParamSchema }),
  asyncHandler(async (req, res) => {
    const order = await service.cancelOwnOrder(
      req.auth!.userId,
      req.params.reference!.toUpperCase(),
    );
    res.json({ order });
  }),
);
