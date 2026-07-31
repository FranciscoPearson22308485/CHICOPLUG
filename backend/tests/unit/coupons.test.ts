import type { Coupon } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { calculateDiscount } from "../../src/modules/orders/coupons.js";

function makeCoupon(overrides: Partial<Coupon>): Coupon {
  return {
    id: "c1",
    code: "TESTE",
    type: "PERCENT",
    value: 10,
    minSubtotal: null,
    maxRedemptions: null,
    timesRedeemed: 0,
    startsAt: null,
    endsAt: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Coupon;
}

describe("cálculo de desconto de cupões", () => {
  it("aplica percentagem sobre o subtotal", () => {
    const coupon = makeCoupon({ type: "PERCENT", value: 10 });
    expect(calculateDiscount(coupon, 156000)).toBe(15600);
  });

  it("aplica valor fixo", () => {
    const coupon = makeCoupon({ type: "FIXED", value: 5000 });
    expect(calculateDiscount(coupon, 40000)).toBe(5000);
  });

  it("arredonda a percentagem para baixo", () => {
    // 33% de 1000 = 330 exacto; 33% de 1001 = 330,33 → 330.
    const coupon = makeCoupon({ type: "PERCENT", value: 33 });
    expect(calculateDiscount(coupon, 1001)).toBe(330);
  });

  it("nunca desconta mais do que o subtotal", () => {
    // Um cupão fixo de 50.000 num carrinho de 20.000 daria um total negativo.
    const coupon = makeCoupon({ type: "FIXED", value: 50000 });
    expect(calculateDiscount(coupon, 20000)).toBe(20000);
  });

  it("trata 100% como carrinho inteiro, não mais", () => {
    const coupon = makeCoupon({ type: "PERCENT", value: 100 });
    expect(calculateDiscount(coupon, 78000)).toBe(78000);
  });

  it("devolve zero num carrinho vazio", () => {
    expect(calculateDiscount(makeCoupon({ type: "PERCENT", value: 20 }), 0)).toBe(0);
    expect(calculateDiscount(makeCoupon({ type: "FIXED", value: 5000 }), 0)).toBe(0);
  });
});
