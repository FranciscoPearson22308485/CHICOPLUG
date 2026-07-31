import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { conflict, notFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { validate } from "../../middleware/validate.js";
import { couponSchema, idParamSchema, updateCouponSchema } from "./admin.schemas.js";

export const adminCouponsRouter = Router();

adminCouponsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orders: true } } },
    });

    const now = new Date();

    res.json({
      coupons: coupons.map((coupon) => ({
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        minSubtotal: coupon.minSubtotal,
        maxRedemptions: coupon.maxRedemptions,
        timesRedeemed: coupon.timesRedeemed,
        startsAt: coupon.startsAt?.toISOString() ?? null,
        endsAt: coupon.endsAt?.toISOString() ?? null,
        active: coupon.active,
        ordersUsing: coupon._count.orders,
        // Estado efectivo: um cupão "activo" mas expirado não funciona, e a UI
        // deve dizê-lo em vez de mostrar um visto verde enganador.
        effectiveStatus: !coupon.active
          ? ("INACTIVO" as const)
          : coupon.startsAt && coupon.startsAt > now
            ? ("AGENDADO" as const)
            : coupon.endsAt && coupon.endsAt < now
              ? ("EXPIRADO" as const)
              : coupon.maxRedemptions !== null && coupon.timesRedeemed >= coupon.maxRedemptions
                ? ("ESGOTADO" as const)
                : ("ACTIVO" as const),
        createdAt: coupon.createdAt.toISOString(),
      })),
    });
  }),
);

adminCouponsRouter.post(
  "/",
  validate({ body: couponSchema }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.coupon.findUnique({ where: { code: req.body.code } });
    if (existing) throw conflict("Já existe um cupão com este código.");

    const coupon = await prisma.coupon.create({
      data: {
        code: req.body.code,
        type: req.body.type,
        value: req.body.value,
        minSubtotal: req.body.minSubtotal ?? null,
        maxRedemptions: req.body.maxRedemptions ?? null,
        startsAt: req.body.startsAt ?? null,
        endsAt: req.body.endsAt ?? null,
        active: req.body.active,
      },
    });

    res.status(201).json({ coupon });
  }),
);

adminCouponsRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateCouponSchema }),
  asyncHandler(async (req, res) => {
    const coupon = await prisma.coupon.update({
      where: { id: req.params.id! },
      data: req.body,
    });
    res.json({ coupon });
  }),
);

/**
 * Cupões já usados são desactivados em vez de apagados: `Order.couponId` guarda
 * a razão do desconto aplicado e apagá-lo perderia essa informação.
 */
adminCouponsRouter.delete(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const coupon = await prisma.coupon.findUnique({
      where: { id: req.params.id! },
      include: { _count: { select: { orders: true } } },
    });
    if (!coupon) throw notFound("Cupão não encontrado.");

    if (coupon._count.orders > 0) {
      await prisma.coupon.update({ where: { id: coupon.id }, data: { active: false } });
      res.json({
        deleted: false,
        archived: true,
        message: "Cupão desactivado: já foi usado em encomendas.",
      });
      return;
    }

    await prisma.coupon.delete({ where: { id: coupon.id } });
    res.json({ deleted: true, archived: false });
  }),
);
