import { PrismaClient } from "@prisma/client";

import { env } from "../config/env.js";

/**
 * Em desenvolvimento o `tsx watch` recarrega o módulo a cada gravação. Sem este
 * cache global acumulam-se clientes Prisma até esgotar o pool de ligações.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isDevelopment ? ["warn", "error"] : ["error"],
  });

if (!env.isProduction) globalForPrisma.prisma = prisma;

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
