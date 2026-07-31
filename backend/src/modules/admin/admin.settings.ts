import { Router } from "express";

import { env } from "../../config/env.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { prisma } from "../../lib/prisma.js";
import { validate } from "../../middleware/validate.js";
import { getProviderStatus } from "../payments/payments.service.js";
import { getStorageStatus } from "../uploads/storage.js";
import { settingsSchema } from "./admin.schemas.js";

export const adminSettingsRouter = Router();

/**
 * Valores por omissão. Preços de envio vêm do ambiente porque também são usados
 * no cálculo do carrinho; os toggles vivem na base porque mudam com o negócio,
 * não com o deploy.
 */
function defaults() {
  return {
    storeName: "CHICOPLUG",
    contactEmail: "ola@chicoplug.ao",
    shippingFlatRate: env.SHIPPING_FLAT_RATE,
    freeShippingThreshold: env.FREE_SHIPPING_THRESHOLD,
    storeActive: true,
    multicaixaEnabled: true,
    freeShippingEnabled: true,
    dropWaitlistEnabled: false,
  };
}

export type StoreSettings = ReturnType<typeof defaults>;

export async function readSettings(): Promise<StoreSettings> {
  const rows = await prisma.storeSetting.findMany();
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return { ...defaults(), ...stored } as StoreSettings;
}

adminSettingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({
      settings: await readSettings(),
      // Estado das integrações, para o painel poder dizer o que falta configurar.
      integrations: {
        payments: getProviderStatus(),
        storage: getStorageStatus(),
      },
    });
  }),
);

adminSettingsRouter.patch(
  "/",
  validate({ body: settingsSchema }),
  asyncHandler(async (req, res) => {
    const entries = Object.entries(req.body as Record<string, unknown>).filter(
      ([, value]) => value !== undefined,
    );

    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.storeSetting.upsert({
          where: { key },
          create: { key, value: value as never },
          update: { value: value as never },
        }),
      ),
    );

    res.json({ settings: await readSettings() });
  }),
);
