import type { Order, OrderStatus, Prisma } from "@prisma/client";
import type { Request, Response } from "express";

import { badRequest, conflict, forbidden, notFound } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { calculateShipping, resolveCart, serializeCart } from "../cart/cart.service.js";
import { evaluateCoupon } from "./coupons.js";
import { canTransition, shouldRestoreStock, STATUS_LABEL } from "./order-status.js";
import type { CheckoutInput } from "./orders.schemas.js";

const orderInclude = {
  items: true,
  payments: { orderBy: { createdAt: "desc" } },
  events: { orderBy: { createdAt: "asc" } },
} as const;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export type SerializedOrder = ReturnType<typeof serializeOrder>;

export function serializeOrder(order: OrderWithRelations) {
  const latestPayment = order.payments[0] ?? null;

  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    statusLabel: STATUS_LABEL[order.status],
    customerName: order.customerName,
    email: order.email,
    phone: order.phone,
    subtotal: order.subtotal,
    shipping: order.shipping,
    discount: order.discount,
    total: order.total,
    shipping_address: {
      province: order.shippingProvince,
      municipality: order.shippingMunicipality,
      street: order.shippingStreet,
      notes: order.shippingNotes,
    },
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      productSlug: item.productSlug,
      imageUrl: item.imageUrl,
      size: item.size,
      colorName: item.colorName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    itemCount: order.items.reduce((n, i) => n + i.quantity, 0),
    payment: latestPayment
      ? {
          id: latestPayment.id,
          provider: latestPayment.provider,
          status: latestPayment.status,
          reference: latestPayment.reference,
          amount: latestPayment.amount,
          paidAt: latestPayment.paidAt?.toISOString() ?? null,
          failureReason: latestPayment.failureReason,
        }
      : null,
    events: order.events.map((event) => ({
      id: event.id,
      from: event.fromStatus,
      to: event.toStatus,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

/**
 * Referência legível e sequencial ("CP-2044"), no formato que o admin e a área
 * de cliente já apresentam. Arrancamos em 2040 para que a numeração pareça
 * contínua com o histórico de exemplo mostrado no design.
 */
async function nextReference(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ next: bigint }>>`
    SELECT COALESCE(MAX(NULLIF(regexp_replace(reference, '\\D', '', 'g'), '')::bigint), 2040) + 1 AS next
    FROM orders
  `;
  const next = rows[0]?.next ?? 2041n;
  return `CP-${next.toString()}`;
}

/**
 * Cria a encomenda a partir do carrinho.
 *
 * Tudo acontece numa transacção: validar stock, decrementá-lo, criar encomenda,
 * linhas, pagamento pendente e esvaziar o carrinho. Se qualquer passo falhar,
 * nada fica meio feito — e o decremento usa `updateMany` com condição de stock
 * suficiente, o que torna impossível vender a mesma última peça a dois clientes
 * que carreguem em "Pagar" no mesmo instante.
 */
export async function createOrderFromCart(
  req: Request,
  res: Response,
  input: CheckoutInput,
): Promise<SerializedOrder> {
  const cart = await resolveCart(req, res);
  if (cart.items.length === 0) throw badRequest("O carrinho está vazio.");

  const serialized = serializeCart(cart);

  // Avaliação do cupão fora da transacção: só consulta, e mantém a transacção curta.
  const couponResult = input.couponCode
    ? await evaluateCoupon(input.couponCode, serialized.subtotal)
    : null;

  const subtotal = serialized.subtotal;
  const discount = couponResult?.discount ?? 0;
  const shipping = calculateShipping(subtotal - discount);
  const total = subtotal - discount + shipping;

  const userId = req.auth?.userId ?? null;

  const order = await prisma.$transaction(async (tx) => {
    // 1. Decremento condicional do stock, variante a variante.
    for (const item of cart.items) {
      const updated = await tx.productVariant.updateMany({
        where: { id: item.variantId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });

      if (updated.count === 0) {
        const current = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          select: { stock: true },
        });
        throw conflict(
          `${item.variant.product.name} (${item.variant.size} / ${item.variant.colorName}) ` +
            `já só tem ${current?.stock ?? 0} unidade(s) disponíveis.`,
        );
      }
    }

    // 2. Encomenda.
    const reference = await nextReference(tx);
    const created = await tx.order.create({
      data: {
        reference,
        userId,
        customerName: input.customerName,
        email: input.email,
        phone: input.phone,
        status: "NOVA",
        subtotal,
        shipping,
        discount,
        total,
        shippingProvince: input.province,
        shippingMunicipality: input.municipality,
        shippingStreet: input.street,
        shippingNotes: input.notes ?? null,
        couponId: couponResult?.coupon.id ?? null,
        items: {
          create: cart.items.map((item) => {
            const unitPrice = item.variant.priceOverride ?? item.variant.product.price;
            return {
              variantId: item.variantId,
              productName: item.variant.product.name,
              productSlug: item.variant.product.slug,
              imageUrl: item.variant.product.images[0]?.url ?? null,
              size: item.variant.size,
              colorName: item.variant.colorName,
              sku: item.variant.sku,
              unitPrice,
              quantity: item.quantity,
              lineTotal: unitPrice * item.quantity,
            };
          }),
        },
        events: {
          create: { toStatus: "NOVA", note: "Encomenda criada." },
        },
      },
      include: orderInclude,
    });

    // 3. Consumo do cupão.
    if (couponResult) {
      await tx.coupon.update({
        where: { id: couponResult.coupon.id },
        data: { timesRedeemed: { increment: 1 } },
      });
    }

    // 4. Esvaziar o carrinho — a encomenda passa a ser a fonte de verdade.
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return created;
  });

  logger.info("Encomenda criada", { reference: order.reference, total: order.total });
  return serializeOrder(order);
}

export async function listUserOrders(userId: string): Promise<SerializedOrder[]> {
  const orders = await prisma.order.findMany({
    where: { userId },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
  return orders.map(serializeOrder);
}

export async function getUserOrder(userId: string, reference: string): Promise<SerializedOrder> {
  const order = await prisma.order.findFirst({
    where: { reference, userId },
    include: orderInclude,
  });
  if (!order) throw notFound("Encomenda não encontrada.");
  return serializeOrder(order);
}

/**
 * Consulta de encomenda por quem comprou sem conta: exige a referência **e** o
 * email usado na compra, para que conhecer só a referência não chegue.
 */
export async function getGuestOrder(reference: string, email: string): Promise<SerializedOrder> {
  const order = await prisma.order.findFirst({
    where: { reference, email: email.toLowerCase() },
    include: orderInclude,
  });
  if (!order) throw notFound("Encomenda não encontrada.");
  return serializeOrder(order);
}

/**
 * Muda o estado de uma encomenda respeitando a máquina de estados e repondo o
 * stock quando é cancelada. A flag `stockRestored` garante que dois
 * cancelamentos concorrentes não devolvem o stock duas vezes.
 */
export async function changeOrderStatus(
  orderId: string,
  to: OrderStatus,
  options: { actorId?: string | undefined; note?: string | undefined } = {},
): Promise<SerializedOrder> {
  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw notFound("Encomenda não encontrada.");

    if (order.status === to) return null;

    if (!canTransition(order.status, to)) {
      throw badRequest(
        `Não é possível passar de "${STATUS_LABEL[order.status]}" para "${STATUS_LABEL[to]}".`,
      );
    }

    if (shouldRestoreStock(order.status, to) && !order.stockRestored) {
      for (const item of order.items) {
        if (!item.variantId) continue;
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
      await tx.order.update({ where: { id: order.id }, data: { stockRestored: true } });
    }

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: to,
        note: options.note ?? null,
        actorId: options.actorId ?? null,
      },
    });

    return tx.order.update({
      where: { id: order.id },
      data: { status: to },
      include: orderInclude,
    });
  });

  if (!updated) {
    const unchanged = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: orderInclude,
    });
    return serializeOrder(unchanged);
  }

  logger.info("Estado de encomenda alterado", { reference: updated.reference, to });
  return serializeOrder(updated);
}

/** Cancelamento pelo próprio cliente — só antes de a encomenda seguir para envio. */
export async function cancelOwnOrder(userId: string, reference: string): Promise<SerializedOrder> {
  const order = await prisma.order.findFirst({ where: { reference, userId } });
  if (!order) throw notFound("Encomenda não encontrada.");

  if (!["NOVA", "CONFIRMADA"].includes(order.status)) {
    throw forbidden(
      "Esta encomenda já está em preparação. Contacta-nos para tratar do cancelamento.",
    );
  }

  return changeOrderStatus(order.id, "CANCELADA", {
    actorId: userId,
    note: "Cancelada pelo cliente.",
  });
}

export async function findOrderByReference(reference: string): Promise<Order | null> {
  return prisma.order.findUnique({ where: { reference } });
}
