import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../../lib/async-handler.js";
import { notFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

export const addressesRouter = Router();

addressesRouter.use(authenticate);

const addressSchema = z.object({
  label: z.string().trim().min(1, "Dá um nome a esta morada.").max(40),
  recipientName: z.string().trim().min(1, "Indica o destinatário.").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s().-]{9,20}$/, "Telefone inválido."),
  province: z.string().trim().min(1, "Escolhe a província.").max(60),
  municipality: z.string().trim().min(1, "Escolhe o município.").max(60),
  street: z.string().trim().min(1, "Indica a morada.").max(240),
  notes: z.string().trim().max(500).optional().nullable(),
  isDefault: z.boolean().optional().default(false),
});

const idParamSchema = z.object({ id: z.string().min(1) });

/**
 * Só pode haver uma morada principal. Fazemos a despromoção das outras dentro
 * da mesma transacção — caso contrário uma falha a meio deixaria o utilizador
 * com duas moradas "principais" e um checkout indeciso.
 */
async function setDefaultExclusively(userId: string, addressId: string): Promise<void> {
  await prisma.$transaction([
    prisma.address.updateMany({
      where: { userId, id: { not: addressId } },
      data: { isDefault: false },
    }),
    prisma.address.update({ where: { id: addressId }, data: { isDefault: true } }),
  ]);
}

addressesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const addresses = await prisma.address.findMany({
      where: { userId: req.auth!.userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    res.json({ addresses });
  }),
);

addressesRouter.post(
  "/",
  validate({ body: addressSchema }),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const count = await prisma.address.count({ where: { userId } });

    const address = await prisma.address.create({
      data: {
        userId,
        label: req.body.label,
        recipientName: req.body.recipientName,
        phone: req.body.phone,
        province: req.body.province,
        municipality: req.body.municipality,
        street: req.body.street,
        notes: req.body.notes ?? null,
        // A primeira morada é automaticamente a principal.
        isDefault: req.body.isDefault || count === 0,
      },
    });

    if (address.isDefault) await setDefaultExclusively(userId, address.id);

    res.status(201).json({ address });
  }),
);

addressesRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: addressSchema.partial() }),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const existing = await prisma.address.findFirst({
      where: { id: req.params.id!, userId },
    });
    if (!existing) throw notFound("Morada não encontrada.");

    const { isDefault, ...rest } = req.body as Record<string, unknown>;

    const address = await prisma.address.update({
      where: { id: existing.id },
      data: rest,
    });

    if (isDefault === true) await setDefaultExclusively(userId, address.id);

    res.json({
      address: await prisma.address.findUniqueOrThrow({ where: { id: address.id } }),
    });
  }),
);

addressesRouter.delete(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const existing = await prisma.address.findFirst({ where: { id: req.params.id!, userId } });
    if (!existing) throw notFound("Morada não encontrada.");

    await prisma.address.delete({ where: { id: existing.id } });

    // Se removemos a principal, promovemos a mais antiga que reste.
    if (existing.isDefault) {
      const next = await prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });
      if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }

    res.status(204).end();
  }),
);
