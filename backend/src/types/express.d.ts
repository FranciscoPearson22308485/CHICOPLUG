import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      /** Preenchido por `authenticate`; ausente em pedidos anónimos. */
      auth?: { userId: string; email: string; role: Role };
      /** Identificador do carrinho anónimo (cookie `cp_cart`). */
      cartSessionId?: string;
    }
  }
}

export {};
