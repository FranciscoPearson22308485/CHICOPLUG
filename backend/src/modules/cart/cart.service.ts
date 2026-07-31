import crypto from "node:crypto";

import type { Request, Response } from "express";

import { env } from "../../config/env.js";
import { CART_COOKIE, setCartCookie } from "../../lib/cookies.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import {
  productInclude,
  serializeProduct,
  type SerializedProduct,
} from "../catalog/catalog.serializer.js";

/**
 * Uma linha do carrinho. Os campos `product`, `size`, `color` e `quantity`
 * replicam o tipo `CartLine` do frontend; o resto é aditivo.
 */
export type SerializedCartLine = {
  id: string;
  variantId: string;
  product: SerializedProduct;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Stock disponível — permite à UI travar o botão "+" no limite real. */
  availableStock: number;
  /** Verdadeiro quando a quantidade pedida já não cabe no stock. */
  exceedsStock: boolean;
};

export type SerializedCart = {
  id: string;
  lines: SerializedCartLine[];
  itemCount: number;
  subtotal: number;
  shipping: number;
  total: number;
  freeShippingThreshold: number;
  /** Quanto falta para envio grátis; 0 quando já se qualifica. */
  amountToFreeShipping: number;
};

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    include: { variant: { include: { product: { include: productInclude } } } },
  },
} as const;

type CartWithItems = Awaited<
  ReturnType<typeof prisma.cart.findFirstOrThrow<{ include: typeof cartInclude }>>
>;

export function calculateShipping(subtotal: number): number {
  if (subtotal === 0) return 0;
  return subtotal >= env.FREE_SHIPPING_THRESHOLD ? 0 : env.SHIPPING_FLAT_RATE;
}

export function serializeCart(cart: CartWithItems): SerializedCart {
  const lines: SerializedCartLine[] = cart.items.map((item) => {
    const variant = item.variant;
    const unitPrice = variant.priceOverride ?? variant.product.price;
    return {
      id: item.id,
      variantId: variant.id,
      product: serializeProduct(variant.product),
      size: variant.size,
      color: variant.colorName,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
      availableStock: variant.stock,
      exceedsStock: item.quantity > variant.stock,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shipping = calculateShipping(subtotal);

  return {
    id: cart.id,
    lines,
    itemCount: lines.reduce((n, line) => n + line.quantity, 0),
    subtotal,
    shipping,
    total: subtotal + shipping,
    freeShippingThreshold: env.FREE_SHIPPING_THRESHOLD,
    amountToFreeShipping: Math.max(0, env.FREE_SHIPPING_THRESHOLD - subtotal),
  };
}

/**
 * Resolve o carrinho do pedido: o do utilizador autenticado ou, em navegação
 * anónima, o associado ao cookie `cp_cart` (criando-o se necessário).
 */
export async function resolveCart(req: Request, res: Response): Promise<CartWithItems> {
  const userId = req.auth?.userId;

  if (userId) {
    const existing = await prisma.cart.findUnique({ where: { userId }, include: cartInclude });
    if (existing) return existing;
    return prisma.cart.create({ data: { userId }, include: cartInclude });
  }

  const cookies = req.cookies as Record<string, string> | undefined;
  let sessionId = cookies?.[CART_COOKIE];

  if (sessionId) {
    const existing = await prisma.cart.findUnique({ where: { sessionId }, include: cartInclude });
    if (existing) return existing;
  }

  sessionId = crypto.randomUUID();
  setCartCookie(res, sessionId);
  return prisma.cart.create({ data: { sessionId }, include: cartInclude });
}

async function reload(cartId: string): Promise<CartWithItems> {
  return prisma.cart.findUniqueOrThrow({ where: { id: cartId }, include: cartInclude });
}

export async function addItem(
  cart: CartWithItems,
  variantId: string,
  quantity: number,
): Promise<CartWithItems> {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { select: { active: true, name: true } } },
  });

  if (!variant || !variant.active || !variant.product.active) {
    throw notFound("Esta variante já não está disponível.");
  }

  const existing = cart.items.find((item) => item.variantId === variantId);
  const desired = (existing?.quantity ?? 0) + quantity;

  if (variant.stock === 0) throw badRequest(`${variant.product.name} está esgotado.`);
  if (desired > variant.stock) {
    throw badRequest(
      `Só temos ${variant.stock} unidade(s) de ${variant.product.name} em ${variant.size} / ${variant.colorName}.`,
    );
  }

  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    create: { cartId: cart.id, variantId, quantity },
    update: { quantity: desired },
  });

  return reload(cart.id);
}

export async function updateItemQuantity(
  cart: CartWithItems,
  itemId: string,
  quantity: number,
): Promise<CartWithItems> {
  const item = cart.items.find((i) => i.id === itemId);
  if (!item) throw notFound("Item não encontrado no carrinho.");

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: itemId } });
    return reload(cart.id);
  }

  if (quantity > item.variant.stock) {
    throw badRequest(`Só temos ${item.variant.stock} unidade(s) desta variante.`);
  }

  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  return reload(cart.id);
}

export async function removeItem(cart: CartWithItems, itemId: string): Promise<CartWithItems> {
  const item = cart.items.find((i) => i.id === itemId);
  if (!item) throw notFound("Item não encontrado no carrinho.");
  await prisma.cartItem.delete({ where: { id: itemId } });
  return reload(cart.id);
}

export async function clearCart(cartId: string): Promise<CartWithItems> {
  await prisma.cartItem.deleteMany({ where: { cartId } });
  return reload(cartId);
}

/**
 * Funde o carrinho anónimo no do utilizador ao iniciar sessão.
 *
 * Somamos quantidades em vez de substituir — quem juntou peças antes de entrar
 * na conta não deve perdê-las — mas travamos sempre no stock disponível, senão
 * a fusão podia criar linhas impossíveis de comprar.
 */
export async function mergeGuestCartIntoUser(req: Request, userId: string): Promise<void> {
  const cookies = req.cookies as Record<string, string> | undefined;
  const sessionId = cookies?.[CART_COOKIE];
  if (!sessionId) return;

  const guestCart = await prisma.cart.findUnique({
    where: { sessionId },
    include: { items: { include: { variant: true } } },
  });
  if (!guestCart || guestCart.items.length === 0) {
    if (guestCart) await prisma.cart.delete({ where: { id: guestCart.id } });
    return;
  }

  const userCart =
    (await prisma.cart.findUnique({ where: { userId } })) ??
    (await prisma.cart.create({ data: { userId } }));

  const existingItems = await prisma.cartItem.findMany({ where: { cartId: userCart.id } });

  await prisma.$transaction(async (tx) => {
    for (const guestItem of guestCart.items) {
      const match = existingItems.find((i) => i.variantId === guestItem.variantId);
      const merged = (match?.quantity ?? 0) + guestItem.quantity;
      const capped = Math.min(merged, guestItem.variant.stock);
      if (capped <= 0) continue;

      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: userCart.id, variantId: guestItem.variantId } },
        create: { cartId: userCart.id, variantId: guestItem.variantId, quantity: capped },
        update: { quantity: capped },
      });
    }
    await tx.cart.delete({ where: { id: guestCart.id } });
  });
}

/**
 * Revalida o carrinho contra o stock actual. Chamado à entrada do checkout:
 * entre adicionar ao carrinho e pagar podem ter passado dias.
 */
export async function validateCartStock(cart: CartWithItems): Promise<
  Array<{ itemId: string; productName: string; requested: number; available: number }>
> {
  return cart.items
    .filter((item) => item.quantity > item.variant.stock)
    .map((item) => ({
      itemId: item.id,
      productName: item.variant.product.name,
      requested: item.quantity,
      available: item.variant.stock,
    }));
}
