import { Router } from "express";

import { authenticate, requireAdmin } from "../../middleware/auth.js";
import { adminCouponsRouter } from "./admin.coupons.js";
import { adminCustomersRouter } from "./admin.customers.js";
import { adminDashboardRouter } from "./admin.dashboard.js";
import { adminOrdersRouter } from "./admin.orders.js";
import { adminProductsRouter } from "./admin.products.js";
import { adminSettingsRouter } from "./admin.settings.js";
import { adminStockRouter } from "./admin.stock.js";
import { adminCategoriesRouter, adminCollectionsRouter } from "./admin.taxonomy.js";

export const adminRouter = Router();

// Um único ponto de entrada garante que nenhuma sub-rota do admin possa ficar
// acidentalmente pública — o erro mais fácil de cometer num painel destes.
adminRouter.use(authenticate, requireAdmin);

adminRouter.use("/dashboard", adminDashboardRouter);
adminRouter.use("/products", adminProductsRouter);
adminRouter.use("/categories", adminCategoriesRouter);
adminRouter.use("/collections", adminCollectionsRouter);
adminRouter.use("/customers", adminCustomersRouter);
adminRouter.use("/orders", adminOrdersRouter);
adminRouter.use("/stock", adminStockRouter);
adminRouter.use("/coupons", adminCouponsRouter);
adminRouter.use("/settings", adminSettingsRouter);
