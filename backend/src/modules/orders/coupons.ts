import type { Coupon } from "@prisma/client";

import { badRequest, notFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

export type CouponEvaluation = {
  coupon: Coupon;
  discount: number;
};

/**
 * Calcula o desconto e arredonda para baixo: com percentagens sobre valores em
 * Kwanzas inteiros, arredondar para cima faria o total pago não bater certo com
 * a soma das linhas.
 */
export function calculateDiscount(coupon: Coupon, subtotal: number): number {
  const raw = coupon.type === "PERCENT" ? (subtotal * coupon.value) / 100 : coupon.value;
  // O desconto nunca pode exceder o subtotal — um total negativo seria absurdo.
  return Math.min(subtotal, Math.floor(raw));
}

export async function evaluateCoupon(code: string, subtotal: number): Promise<CouponEvaluation> {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });

  if (!coupon || !coupon.active) throw notFound("Cupão inválido.");

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw badRequest("Este cupão ainda não começou.");
  if (coupon.endsAt && coupon.endsAt < now) throw badRequest("Este cupão expirou.");

  if (coupon.maxRedemptions !== null && coupon.timesRedeemed >= coupon.maxRedemptions) {
    throw badRequest("Este cupão atingiu o limite de utilizações.");
  }

  if (coupon.minSubtotal !== null && subtotal < coupon.minSubtotal) {
    throw badRequest(`Este cupão exige um subtotal mínimo de ${coupon.minSubtotal} Kz.`);
  }

  return { coupon, discount: calculateDiscount(coupon, subtotal) };
}
