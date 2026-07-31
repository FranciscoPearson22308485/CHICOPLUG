import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { disconnectPrisma, prisma } from "./lib/prisma.js";
import { getProviderStatus } from "./modules/payments/payments.service.js";

async function main(): Promise<void> {
  // Falhar aqui é melhor do que servir 500 no primeiro pedido.
  await prisma.$queryRaw`SELECT 1`;

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API CHICOPLUG a escutar em http://localhost:${env.PORT}`, {
      env: env.NODE_ENV,
      cors: env.corsOrigins,
    });

    const payments = getProviderStatus();
    if (!payments.configured) {
      logger.warn("Provedor de pagamentos por configurar", payments);
    }
    if (!env.cloudinaryEnabled) {
      logger.warn("Cloudinary por configurar — uploads guardados localmente em ./uploads");
    }
  });

  // Encerramento limpo: deixa terminar os pedidos em curso antes de sair, para
  // que um redeploy não corte um checkout a meio.
  const shutdown = (signal: string) => {
    logger.info(`Recebido ${signal}, a encerrar…`);
    server.close(() => {
      void disconnectPrisma().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  logger.error("Falha no arranque da API", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
