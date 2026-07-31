import path from "node:path";

import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { issueCsrfToken, verifyCsrf } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { apiLimiter } from "./middleware/rate-limit.js";
import { sanitizeInput } from "./middleware/sanitize.js";
import { addressesRouter } from "./modules/addresses/addresses.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { cartRouter } from "./modules/cart/cart.routes.js";
import { catalogRouter } from "./modules/catalog/catalog.routes.js";
import { ordersRouter } from "./modules/orders/orders.routes.js";
import { paymentsRouter } from "./modules/payments/payments.routes.js";
import { seoRouter } from "./modules/seo/seo.routes.js";
import { uploadsRouter } from "./modules/uploads/uploads.routes.js";
import { wishlistRouter } from "./modules/wishlist/wishlist.routes.js";

export function createApp(): Express {
  const app = express();

  // Necessário para que `req.ip` seja o IP real do cliente atrás de um
  // balanceador — sem isto o rate limiting agrupa toda a gente no mesmo IP.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    helmet({
      // A API serve JSON e imagens; não há HTML nosso a proteger com CSP aqui,
      // mas mantemos uma política restritiva para as imagens servidas em /static.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
          scriptSrc: ["'none'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      // Imagens têm de poder ser carregadas pelo frontend noutra origem.
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Pedidos sem Origin (curl, apps móveis, health checks) passam.
        if (!origin) return callback(null, true);
        if (env.corsOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Origem não autorizada: ${origin}`));
      },
      credentials: true,
      exposedHeaders: ["x-csrf-token"],
    }),
  );

  app.use(compression());
  // Limite de 1 MB: nenhum endpoint JSON legítimo precisa de mais, e um limite
  // apertado é a defesa mais barata contra corpos gigantes.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());
  app.use(sanitizeInput);

  app.use("/api", apiLimiter);
  app.use("/api", issueCsrfToken);

  // Health check antes do CSRF — usado por orquestradores.
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), env: env.NODE_ENV });
  });

  // O callback do Multicaixa vem da EMIS, não de um browser: não tem — nem
  // pode ter — cookie CSRF. É autenticado por assinatura no próprio adaptador.
  app.use("/api/payments/multicaixa", paymentsRouter);

  app.use("/api", verifyCsrf);

  app.use("/api/auth", authRouter);
  app.use("/api/catalog", catalogRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api/wishlist", wishlistRouter);
  app.use("/api/addresses", addressesRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/admin", adminRouter);

  // SEO (sitemap.xml / robots.txt) vive na raiz, fora de /api.
  app.use("/", seoRouter);

  // Fallback de armazenamento local quando o Cloudinary não está configurado.
  app.use(
    "/static/uploads",
    express.static(path.resolve(process.cwd(), "uploads"), {
      maxAge: "30d",
      immutable: true,
      index: false,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
