import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { prisma } from "../../lib/prisma.js";
import { serializeOrder } from "../orders/orders.service.js";

export const adminDashboardRouter = Router();

/** Encomendas que não contam como receita. */
const REVENUE_FILTER = { status: { not: "CANCELADA" as const } };

function daysAgo(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Métricas do dashboard.
 *
 * Todas as percentagens comparam a janela actual com a imediatamente anterior
 * do mesmo tamanho — é a comparação que o design mostra ("+18% vs. mês
 * anterior") e a única que não engana quando o negócio tem sazonalidade.
 */
adminDashboardRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const last30 = daysAgo(30);
    const previous30 = daysAgo(60);
    const today = daysAgo(0);

    const [
      currentPeriod,
      previousPeriod,
      ordersToday,
      recentOrders,
      lowStockVariants,
      customerCount,
      productCount,
      statusBreakdown,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { ...REVENUE_FILTER, createdAt: { gte: last30 } },
        _sum: { total: true },
        _count: { _all: true },
        _avg: { total: true },
      }),
      prisma.order.aggregate({
        where: { ...REVENUE_FILTER, createdAt: { gte: previous30, lt: last30 } },
        _sum: { total: true },
        _count: { _all: true },
        _avg: { total: true },
      }),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.findMany({
        include: {
          items: true,
          payments: { orderBy: { createdAt: "desc" } },
          events: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.productVariant.findMany({
        where: { active: true, product: { active: true } },
        include: { product: { select: { id: true, name: true } } },
        orderBy: { stock: "asc" },
        take: 60,
      }),
      prisma.user.count({ where: { role: "USER" } }),
      prisma.product.count({ where: { active: true } }),
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    const revenue = currentPeriod._sum.total ?? 0;
    const previousRevenue = previousPeriod._sum.total ?? 0;
    const orderCount = currentPeriod._count._all;
    const previousOrderCount = previousPeriod._count._all;
    const averageTicket = Math.round(currentPeriod._avg.total ?? 0);
    const previousTicket = Math.round(previousPeriod._avg.total ?? 0);

    // Sem base de comparação uma "variação" é indefinida, não 0% nem 100%.
    const delta = (current: number, previous: number): number | null =>
      previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10;

    // Série mensal dos últimos 6 meses para o gráfico de barras.
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRows = await prisma.$queryRaw<
      Array<{ month: Date; orders: bigint; revenue: bigint | null }>
    >`
      SELECT date_trunc('month', "createdAt") AS month,
             COUNT(*)                        AS orders,
             SUM(total)                      AS revenue
      FROM orders
      WHERE "createdAt" >= ${sixMonthsAgo} AND status <> 'CANCELADA'
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const MONTH_LABEL = [
      "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
      "Jul", "Ago", "Set", "Out", "Nov", "Dez",
    ];

    const monthly = monthlyRows.map((row) => ({
      month: MONTH_LABEL[row.month.getMonth()] ?? "",
      year: row.month.getFullYear(),
      orders: Number(row.orders),
      revenue: Number(row.revenue ?? 0),
    }));

    const lowStock = lowStockVariants
      .filter((v) => v.stock <= v.lowStockThreshold)
      .slice(0, 8)
      .map((v) => ({
        variantId: v.id,
        productId: v.product.id,
        productName: v.product.name,
        size: v.size,
        colorName: v.colorName,
        stock: v.stock,
      }));

    res.json({
      metrics: {
        revenue30d: revenue,
        revenueDelta: delta(revenue, previousRevenue),
        orders30d: orderCount,
        ordersDelta: delta(orderCount, previousOrderCount),
        ordersToday,
        averageTicket,
        averageTicketDelta: delta(averageTicket, previousTicket),
        customerCount,
        productCount,
      },
      recentOrders: recentOrders.map(serializeOrder),
      lowStock,
      statusBreakdown: statusBreakdown.map((s) => ({ status: s.status, count: s._count._all })),
      monthly,
    });
  }),
);

/** Página de relatórios: janela configurável e produtos mais vendidos. */
adminDashboardRouter.get(
  "/reports",
  asyncHandler(async (req, res) => {
    const days = Math.min(365, Math.max(7, Number(req.query["days"] ?? 180)));
    const since = daysAgo(days);

    const [totals, itemsSold, topProducts, cancelled] = await Promise.all([
      prisma.order.aggregate({
        where: { ...REVENUE_FILTER, createdAt: { gte: since } },
        _sum: { total: true, discount: true },
        _count: { _all: true },
      }),
      prisma.orderItem.aggregate({
        where: { order: { ...REVENUE_FILTER, createdAt: { gte: since } } },
        _sum: { quantity: true },
      }),
      prisma.orderItem.groupBy({
        by: ["productSlug", "productName"],
        where: { order: { ...REVENUE_FILTER, createdAt: { gte: since } } },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 10,
      }),
      prisma.order.count({ where: { status: "CANCELADA", createdAt: { gte: since } } }),
    ]);

    const orderCount = totals._count._all;

    res.json({
      windowDays: days,
      revenue: totals._sum.total ?? 0,
      discountGiven: totals._sum.discount ?? 0,
      orders: orderCount,
      itemsSold: itemsSold._sum.quantity ?? 0,
      cancelledOrders: cancelled,
      cancellationRate:
        orderCount + cancelled === 0
          ? 0
          : Math.round((cancelled / (orderCount + cancelled)) * 1000) / 10,
      topProducts: topProducts.map((p) => ({
        productSlug: p.productSlug,
        productName: p.productName,
        quantity: p._sum.quantity ?? 0,
        revenue: p._sum.lineTotal ?? 0,
      })),
    });
  }),
);
