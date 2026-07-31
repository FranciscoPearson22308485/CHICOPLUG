import type { Express } from "express";
import request from "supertest";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/lib/password.js";
import { prisma } from "../src/lib/prisma.js";

export const app: Express = createApp();

/** Limpa a base entre testes, respeitando a ordem das dependências. */
export async function resetDatabase(): Promise<void> {
  await prisma.orderEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.address.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.category.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.user.deleteMany();
  await prisma.storeSetting.deleteMany();
}

export type SeededCatalog = {
  categoryId: string;
  productId: string;
  productSlug: string;
  /** Variante com stock — a usada na maioria dos testes. */
  variantId: string;
  variantStock: number;
  /** Variante com stock 1, para exercitar limites. */
  scarceVariantId: string;
};

export async function seedCatalog(): Promise<SeededCatalog> {
  const category = await prisma.category.create({
    data: { name: "Hoodies", slug: "hoodies" },
  });

  const product = await prisma.product.create({
    data: {
      slug: "hoodie-teste",
      name: "Hoodie Teste",
      description: "Hoodie para testes automatizados.",
      details: ["Algodão 480gsm"],
      price: 50000,
      categoryId: category.id,
      images: { create: [{ url: "/static/uploads/produtos/teste.webp", position: 0 }] },
      variants: {
        create: [
          {
            size: "M",
            colorName: "Preto",
            colorHex: "#111111",
            sku: "CP-TESTE-M-PRETO",
            stock: 10,
          },
          {
            size: "L",
            colorName: "Preto",
            colorHex: "#111111",
            sku: "CP-TESTE-L-PRETO",
            stock: 1,
          },
        ],
      },
    },
    include: { variants: { orderBy: { createdAt: "asc" } } },
  });

  const [main, scarce] = product.variants;

  return {
    categoryId: category.id,
    productId: product.id,
    productSlug: product.slug,
    variantId: main!.id,
    variantStock: main!.stock,
    scarceVariantId: scarce!.id,
  };
}

export async function createUser(input: {
  email: string;
  password: string;
  role?: "USER" | "ADMIN";
}): Promise<{ id: string; email: string }> {
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      firstName: "Teste",
      lastName: "Utilizador",
      role: input.role ?? "USER",
    },
  });
  return { id: user.id, email: user.email };
}

type Agent = ReturnType<typeof request.agent>;

/**
 * Cliente de teste que reproduz o comportamento de um browser real.
 *
 * A protecção CSRF é double-submit: o cookie `cp_csrf` tem de ser repetido no
 * cabeçalho `x-csrf-token`. Um browser obtém sempre o cookie no primeiro GET
 * (a app faz `/api/auth/me` ao arrancar) antes de qualquer submissão. O
 * supertest não faz isso sozinho, por isso preparamos aqui o mesmo passo — de
 * outro modo estaríamos a testar um cliente que nenhum utilizador tem.
 */
export type TestClient = Agent & { csrf: () => string };

const csrfTokens = new WeakMap<object, string>();

function withCsrf(client: Agent): TestClient {
  const wrapped = client as TestClient;
  wrapped.csrf = () => csrfTokens.get(client) ?? "";

  for (const method of ["post", "patch", "put", "delete"] as const) {
    const original = client[method].bind(client);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)[method] = (url: string) => {
      const token = csrfTokens.get(client);
      const req = original(url);
      return token ? req.set("x-csrf-token", token) : req;
    };
  }

  return wrapped;
}

/**
 * Agente com jar de cookies partilhado e token CSRF já obtido.
 * `await` obrigatório: o token vem de um pedido real ao servidor.
 */
export async function testClient(): Promise<TestClient> {
  const instance = request.agent(app);

  // Passo que o browser dá naturalmente: um GET que devolve o cookie CSRF.
  const primer = await instance.get("/api/health");
  const cookies = (primer.headers["set-cookie"] as unknown as string[] | undefined) ?? [];
  const csrfCookie = cookies.find((c) => c.startsWith("cp_csrf="));
  if (csrfCookie) {
    csrfTokens.set(instance, decodeURIComponent(csrfCookie.split(";")[0]!.split("=")[1]!));
  }

  return withCsrf(instance);
}

/** Agente sem token CSRF — usado para testar que a protecção realmente bloqueia. */
export function rawAgent(): Agent {
  return request.agent(app);
}

/** Inicia sessão e devolve o cliente autenticado. */
export async function loginAs(email: string, password: string): Promise<TestClient> {
  const instance = await testClient();
  const response = await instance.post("/api/auth/login").send({ email, password });
  if (response.status !== 200) {
    throw new Error(`Login falhou (${response.status}): ${JSON.stringify(response.body)}`);
  }
  return instance;
}

export { prisma };
