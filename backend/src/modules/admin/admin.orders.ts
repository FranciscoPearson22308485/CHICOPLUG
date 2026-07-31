import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { notFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { validate } from "../../middleware/validate.js";
import { allowedTransitions, STATUS_LABEL } from "../orders/order-status.js";
import { changeOrderStatus, serializeOrder } from "../orders/orders.service.js";
import { idParamSchema, orderListSchema, orderStatusSchema } from "./admin.schemas.js";

export const adminOrdersRouter = Router();

adminOrdersRouter.get(
  "/",
  validate({ query: orderListSchema }),
  asyncHandler(async (req, res) => {
    const { page, pageSize, search, status } = req.query as unknown as {
      page: number;
      pageSize: number;
      search?: string;
      status?: import("@prisma/client").OrderStatus;
    };

    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { reference: { contains: search, mode: "insensitive" as const } },
              { customerName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          payments: { orderBy: { createdAt: "desc" } },
          events: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders: rows.map((order) => ({
        ...serializeOrder(order),
        // A UI usa isto para só oferecer botões de transições realmente válidas.
        allowedTransitions: allowedTransitions(order.status).map((s) => ({
          value: s,
          label: STATUS_LABEL[s],
        })),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  }),
);

adminOrdersRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id! },
      include: {
        items: true,
        payments: { orderBy: { createdAt: "desc" } },
        events: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!order) throw notFound("Encomenda não encontrada.");

    res.json({
      order: {
        ...serializeOrder(order),
        allowedTransitions: allowedTransitions(order.status).map((s) => ({
          value: s,
          label: STATUS_LABEL[s],
        })),
      },
    });
  }),
);

adminOrdersRouter.post(
  "/:id/status",
  validate({ params: idParamSchema, body: orderStatusSchema }),
  asyncHandler(async (req, res) => {
    const order = await changeOrderStatus(req.params.id!, req.body.status, {
      actorId: req.auth!.userId,
      note: req.body.note,
    });
    res.json({ order });
  }),
);

/**
 * Exportação CSV para o botão "Exportar" do ecrã de encomendas.
 * Prefixamos células que comecem por =, +, - ou @ com um apóstrofo: sem isso,
 * um nome como "=CMD()" seria interpretado como fórmula ao abrir no Excel.
 */
adminOrdersRouter.get(
  "/export/csv",
  asyncHandler(async (_req, res) => {
    const orders = await prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const escape = (value: unknown): string => {
      const text = String(value ?? "");
      const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${guarded.replace(/"/g, '""')}"`;
    };

    const header = [
      "Referencia",
      "Data",
      "Cliente",
      "Email",
      "Telefone",
      "Provincia",
      "Municipio",
      "Morada",
      "Estado",
      "Pecas",
      "Subtotal",
      "Envio",
      "Desconto",
      "Total",
    ];

    const lines = orders.map((order) =>
      [
        order.reference,
        order.createdAt.toISOString(),
        order.customerName,
        order.email,
        order.phone,
        order.shippingProvince,
        order.shippingMunicipality,
        order.shippingStreet,
        STATUS_LABEL[order.status],
        order.items.reduce((n, i) => n + i.quantity, 0),
        order.subtotal,
        order.shipping,
        order.discount,
        order.total,
      ]
        .map(escape)
        .join(","),
    );

    // BOM para que o Excel reconheça UTF-8 e não parta os acentos.
    const csv = `﻿${[header.map(escape).join(","), ...lines].join("\n")}`;

    res.type("text/csv");
    res.set("Content-Disposition", `attachment; filename="encomendas-chicoplug.csv"`);
    res.send(csv);
  }),
);
