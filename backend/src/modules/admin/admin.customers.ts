import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { validate } from "../../middleware/validate.js";
import { idParamSchema, paginationSchema, updateCustomerSchema } from "./admin.schemas.js";

export const adminCustomersRouter = Router();

/**
 * Lista de clientes com encomendas e total gasto — exactamente as colunas que a
 * tabela do admin apresenta. Agregamos numa consulta `groupBy` em vez de contar
 * por cliente em ciclo, que seria N+1.
 */
adminCustomersRouter.get(
  "/",
  validate({ query: paginationSchema }),
  asyncHandler(async (req, res) => {
    const { page, pageSize, search } = req.query as unknown as {
      page: number;
      pageSize: number;
      search?: string;
    };

    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          active: true,
          marketingOptIn: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    const stats = await prisma.order.groupBy({
      by: ["userId"],
      where: { userId: { in: users.map((u) => u.id) }, status: { not: "CANCELADA" } },
      _count: { _all: true },
      _sum: { total: true },
    });

    const byUser = new Map(stats.map((s) => [s.userId, s]));

    res.json({
      customers: users.map((user) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
        name: `${user.firstName} ${user.lastName}`,
        orderCount: byUser.get(user.id)?._count._all ?? 0,
        totalSpent: byUser.get(user.id)?._sum.total ?? 0,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  }),
);

adminCustomersRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id! },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        marketingOptIn: true,
        createdAt: true,
        addresses: true,
        orders: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            reference: true,
            status: true,
            total: true,
            createdAt: true,
          },
        },
      },
    });
    if (!user) throw notFound("Cliente não encontrado.");

    res.json({
      customer: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        name: `${user.firstName} ${user.lastName}`,
        orders: user.orders.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })),
      },
    });
  }),
);

adminCustomersRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateCustomerSchema }),
  asyncHandler(async (req, res) => {
    const id = req.params.id!;

    // Um administrador não se pode despromover nem desactivar a si próprio: seria
    // possível ficar sem nenhum admin activo e sem forma de recuperar pela UI.
    if (id === req.auth!.userId) {
      if (req.body.role === "USER") throw badRequest("Não te podes despromover a ti próprio.");
      if (req.body.active === false) throw badRequest("Não podes desactivar a tua própria conta.");
    }

    const user = await prisma.user.update({
      where: { id },
      data: req.body,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        marketingOptIn: true,
        createdAt: true,
      },
    });

    // Desactivar termina as sessões abertas imediatamente.
    if (req.body.active === false) {
      await prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    res.json({
      customer: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        name: `${user.firstName} ${user.lastName}`,
      },
    });
  }),
);

/**
 * Clientes com histórico são desactivados, não apagados: as encomendas têm de
 * sobreviver para efeitos contabilísticos.
 */
adminCustomersRouter.delete(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const id = req.params.id!;
    if (id === req.auth!.userId) throw badRequest("Não podes remover a tua própria conta.");

    const orderCount = await prisma.order.count({ where: { userId: id } });

    if (orderCount > 0) {
      await prisma.user.update({ where: { id }, data: { active: false } });
      await prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      res.json({
        deleted: false,
        archived: true,
        message: "Cliente desactivado: tem encomendas no histórico.",
      });
      return;
    }

    await prisma.user.delete({ where: { id } });
    res.json({ deleted: true, archived: false });
  }),
);
