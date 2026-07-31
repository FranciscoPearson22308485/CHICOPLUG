import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createUser,
  loginAs,
  prisma,
  resetDatabase,
  seedCatalog,
  testClient,
  type SeededCatalog,
  type TestClient,
} from "../helpers.js";

const CHECKOUT_INPUT = {
  customerName: "Ana Miguel",
  email: "ana@chicoplug.ao",
  phone: "+244900111222",
  province: "Luanda",
  municipality: "Talatona",
  street: "Rua Amílcar Cabral, 42",
};

describe("checkout, pagamentos e encomendas", () => {
  let catalog: SeededCatalog;

  beforeEach(async () => {
    await resetDatabase();
    catalog = await seedCatalog();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Cliente anónimo já com peças no carrinho. */
  async function cartWith(quantity: number, variantId?: string): Promise<TestClient> {
    const client = await testClient();
    await client
      .post("/api/cart/items")
      .send({ variantId: variantId ?? catalog.variantId, quantity });
    return client;
  }

  it("cria a encomenda a partir do carrinho", async () => {
    const client = await cartWith(2);
    const response = await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);

    expect(response.status).toBe(201);
    expect(response.body.order.status).toBe("NOVA");
    expect(response.body.order.reference).toMatch(/^CP-\d+$/);
    expect(response.body.order.subtotal).toBe(100000);
    expect(response.body.order.total).toBe(100000);
  });

  it("recusa checkout com carrinho vazio", async () => {
    const client = await testClient();
    const response = await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);
    expect(response.status).toBe(400);
  });

  it("valida os dados de entrega", async () => {
    const client = await cartWith(1);
    const response = await client
      .post("/api/orders/checkout")
      .send({ ...CHECKOUT_INPUT, email: "nao-e-email", phone: "123" });

    expect(response.status).toBe(422);
  });

  it("decrementa o stock ao criar a encomenda", async () => {
    const client = await cartWith(3);
    await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);

    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: catalog.variantId },
    });
    expect(variant.stock).toBe(catalog.variantStock - 3);
  });

  it("esvazia o carrinho depois da encomenda", async () => {
    const client = await cartWith(2);
    await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);

    expect((await client.get("/api/cart")).body.cart.lines).toHaveLength(0);
  });

  it("guarda um instantâneo do produto que sobrevive a alterações do catálogo", async () => {
    const client = await cartWith(1);
    const response = await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);

    const item = response.body.order.items[0];
    expect(item.productName).toBe("Hoodie Teste");
    expect(item.unitPrice).toBe(50000);
    expect(item.size).toBe("M");
    expect(item.colorName).toBe("Preto");

    // Alterar o catálogo não pode reescrever o histórico de compras.
    await prisma.product.update({
      where: { id: catalog.productId },
      data: { name: "Nome Novo", price: 99999 },
    });

    const stored = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: response.body.order.id },
    });
    expect(stored.productName).toBe("Hoodie Teste");
    expect(stored.unitPrice).toBe(50000);
  });

  it("impede overselling quando o stock muda entre o carrinho e o pagamento", async () => {
    const client = await cartWith(1, catalog.scarceVariantId);

    // Alguém comprou a última peça entretanto.
    await prisma.productVariant.update({
      where: { id: catalog.scarceVariantId },
      data: { stock: 0 },
    });

    const response = await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);
    expect(response.status).toBe(409);

    // E o stock nunca pode ficar negativo.
    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: catalog.scarceVariantId },
    });
    expect(variant.stock).toBe(0);
  });

  it("não cria encomenda quando o stock é insuficiente", async () => {
    const client = await cartWith(1, catalog.scarceVariantId);
    await prisma.productVariant.update({
      where: { id: catalog.scarceVariantId },
      data: { stock: 0 },
    });

    await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);

    // A transacção falhou por inteiro — nada de encomendas órfãs.
    expect(await prisma.order.count()).toBe(0);
  });

  describe("cupões", () => {
    beforeEach(async () => {
      await prisma.coupon.create({
        data: { code: "DROP10", type: "PERCENT", value: 10, active: true },
      });
    });

    it("aplica o desconto ao total", async () => {
      const client = await cartWith(2);
      const response = await client
        .post("/api/orders/checkout")
        .send({ ...CHECKOUT_INPUT, couponCode: "DROP10" });

      expect(response.body.order.subtotal).toBe(100000);
      expect(response.body.order.discount).toBe(10000);
      // 100.000 − 10.000 = 90.000, abaixo do limiar → volta a pagar envio.
      expect(response.body.order.shipping).toBe(3500);
      expect(response.body.order.total).toBe(93500);
    });

    it("regista a utilização do cupão", async () => {
      const client = await cartWith(2);
      await client
        .post("/api/orders/checkout")
        .send({ ...CHECKOUT_INPUT, couponCode: "DROP10" });

      const coupon = await prisma.coupon.findUniqueOrThrow({ where: { code: "DROP10" } });
      expect(coupon.timesRedeemed).toBe(1);
    });

    it("recusa cupão inexistente", async () => {
      const client = await cartWith(1);
      const response = await client
        .post("/api/orders/checkout")
        .send({ ...CHECKOUT_INPUT, couponCode: "NAOEXISTE" });

      expect(response.status).toBe(404);
    });

    it("recusa cupão esgotado", async () => {
      await prisma.coupon.update({
        where: { code: "DROP10" },
        data: { maxRedemptions: 1, timesRedeemed: 1 },
      });

      const client = await cartWith(1);
      const response = await client
        .post("/api/orders/checkout")
        .send({ ...CHECKOUT_INPUT, couponCode: "DROP10" });

      expect(response.status).toBe(400);
    });

    it("recusa cupão abaixo do subtotal mínimo", async () => {
      await prisma.coupon.update({ where: { code: "DROP10" }, data: { minSubtotal: 200000 } });

      const client = await cartWith(1);
      const response = await client
        .post("/api/orders/checkout")
        .send({ ...CHECKOUT_INPUT, couponCode: "DROP10" });

      expect(response.status).toBe(400);
    });

    it("recusa cupão expirado", async () => {
      await prisma.coupon.update({
        where: { code: "DROP10" },
        data: { endsAt: new Date(Date.now() - 86_400_000) },
      });

      const client = await cartWith(1);
      const response = await client
        .post("/api/orders/checkout")
        .send({ ...CHECKOUT_INPUT, couponCode: "DROP10" });

      expect(response.status).toBe(400);
    });
  });

  describe("pagamento", () => {
    it("cria um pagamento pendente com a encomenda", async () => {
      const client = await cartWith(1);
      const response = await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);

      expect(response.body.payment.status).toBe("PENDENTE");
      expect(response.body.payment.amount).toBe(response.body.order.total);
    });

    it("confirma a encomenda quando o pagamento é aceite", async () => {
      const client = await cartWith(1);
      const checkout = await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);

      await client
        .post("/api/payments/simulate")
        .send({ reference: checkout.body.payment.reference, status: "PAGO" });

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: checkout.body.order.id },
      });
      expect(order.status).toBe("CONFIRMADA");
    });

    it("é idempotente perante callbacks repetidos", async () => {
      const client = await cartWith(1);
      const checkout = await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);
      const reference = checkout.body.payment.reference;

      await client.post("/api/payments/simulate").send({ reference, status: "PAGO" });
      await client.post("/api/payments/simulate").send({ reference, status: "PAGO" });

      // A EMIS reenvia callbacks em caso de timeout: confirmar duas vezes seria um bug.
      const events = await prisma.orderEvent.count({
        where: { orderId: checkout.body.order.id, toStatus: "CONFIRMADA" },
      });
      expect(events).toBe(1);
    });

    it("não regride um pagamento já concluído", async () => {
      const client = await cartWith(1);
      const checkout = await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);
      const reference = checkout.body.payment.reference;

      await client.post("/api/payments/simulate").send({ reference, status: "PAGO" });
      await client.post("/api/payments/simulate").send({ reference, status: "FALHADO" });

      const payment = await prisma.payment.findUniqueOrThrow({ where: { reference } });
      expect(payment.status).toBe("PAGO");
    });

    it("cancela a encomenda quando o pagamento é cancelado", async () => {
      const client = await cartWith(1);
      const checkout = await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);

      await client
        .post("/api/payments/simulate")
        .send({ reference: checkout.body.payment.reference, status: "CANCELADO" });

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: checkout.body.order.id },
      });
      expect(order.status).toBe("CANCELADA");
    });

    it("reutiliza a tentativa pendente em vez de criar cobranças paralelas", async () => {
      const client = await cartWith(1);
      const checkout = await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);
      const reference = checkout.body.order.reference;

      const retry = await client.post(`/api/payments/orders/${reference}/start`);

      expect(retry.body.payment.reference).toBe(checkout.body.payment.reference);
      expect(await prisma.payment.count({ where: { orderId: checkout.body.order.id } })).toBe(1);
    });

    it("reporta o estado da integração", async () => {
      const client = await testClient();
      const response = await client.get("/api/payments/status");

      expect(response.status).toBe(200);
      expect(response.body.provider).toBe("mock");
      expect(response.body.configured).toBe(true);
    });
  });

  describe("ciclo de vida da encomenda", () => {
    it("repõe o stock ao cancelar", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });
      const client = await loginAs("ana@chicoplug.ao", "Password1");
      await client.post("/api/cart/items").send({ variantId: catalog.variantId, quantity: 3 });

      const checkout = await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);

      const afterOrder = await prisma.productVariant.findUniqueOrThrow({
        where: { id: catalog.variantId },
      });
      expect(afterOrder.stock).toBe(catalog.variantStock - 3);

      await client.post(`/api/orders/${checkout.body.order.reference}/cancel`);

      const afterCancel = await prisma.productVariant.findUniqueOrThrow({
        where: { id: catalog.variantId },
      });
      expect(afterCancel.stock).toBe(catalog.variantStock);
    });

    it("não repõe o stock duas vezes", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });
      const client = await loginAs("ana@chicoplug.ao", "Password1");
      await client.post("/api/cart/items").send({ variantId: catalog.variantId, quantity: 3 });
      const checkout = await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);

      await client.post(`/api/orders/${checkout.body.order.reference}/cancel`);
      await client.post(`/api/orders/${checkout.body.order.reference}/cancel`);

      const variant = await prisma.productVariant.findUniqueOrThrow({
        where: { id: catalog.variantId },
      });
      expect(variant.stock).toBe(catalog.variantStock);
    });

    it("impede o cliente de cancelar depois de entrar em preparação", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });
      const client = await loginAs("ana@chicoplug.ao", "Password1");
      await client.post("/api/cart/items").send({ variantId: catalog.variantId, quantity: 1 });
      const checkout = await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);

      await prisma.order.update({
        where: { id: checkout.body.order.id },
        data: { status: "EM_PREPARACAO" },
      });

      const response = await client.post(`/api/orders/${checkout.body.order.reference}/cancel`);
      expect(response.status).toBe(403);
    });

    it("um cliente não vê as encomendas de outro", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });
      await createUser({ email: "nuno@chicoplug.ao", password: "Password1" });

      const ana = await loginAs("ana@chicoplug.ao", "Password1");
      await ana.post("/api/cart/items").send({ variantId: catalog.variantId, quantity: 1 });
      const checkout = await ana.post("/api/orders/checkout").send(CHECKOUT_INPUT);

      const nuno = await loginAs("nuno@chicoplug.ao", "Password1");
      const response = await nuno.get(`/api/orders/${checkout.body.order.reference}`);

      expect(response.status).toBe(404);
    });

    it("permite consulta sem conta com referência e email correctos", async () => {
      const client = await cartWith(1);
      const checkout = await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);

      const ok = await client
        .post("/api/orders/lookup")
        .send({ reference: checkout.body.order.reference, email: CHECKOUT_INPUT.email });
      expect(ok.status).toBe(200);

      // Conhecer só a referência não pode chegar.
      const wrongEmail = await client
        .post("/api/orders/lookup")
        .send({ reference: checkout.body.order.reference, email: "outro@chicoplug.ao" });
      expect(wrongEmail.status).toBe(404);
    });

    it("o administrador respeita a máquina de estados", async () => {
      await createUser({ email: "admin@chicoplug.ao", password: "Password1", role: "ADMIN" });
      const client = await cartWith(1);
      const checkout = await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);
      const orderId = checkout.body.order.id;

      const admin = await loginAs("admin@chicoplug.ao", "Password1");

      const salto = await admin
        .post(`/api/admin/orders/${orderId}/status`)
        .send({ status: "ENTREGUE" });
      expect(salto.status).toBe(400);

      const valido = await admin
        .post(`/api/admin/orders/${orderId}/status`)
        .send({ status: "CONFIRMADA" });
      expect(valido.status).toBe(200);
      expect(valido.body.order.status).toBe("CONFIRMADA");
    });

    it("regista o histórico de transições", async () => {
      await createUser({ email: "admin@chicoplug.ao", password: "Password1", role: "ADMIN" });
      const client = await cartWith(1);
      const checkout = await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);
      const orderId = checkout.body.order.id;

      const admin = await loginAs("admin@chicoplug.ao", "Password1");
      await admin.post(`/api/admin/orders/${orderId}/status`).send({ status: "CONFIRMADA" });
      await admin.post(`/api/admin/orders/${orderId}/status`).send({ status: "EM_PREPARACAO" });

      const response = await admin.get(`/api/admin/orders/${orderId}`);
      // Criação + duas transições.
      expect(response.body.order.events).toHaveLength(3);
    });
  });

  describe("administração", () => {
    beforeEach(async () => {
      await createUser({ email: "admin@chicoplug.ao", password: "Password1", role: "ADMIN" });
    });

    it("ajusta o stock em modo absoluto", async () => {
      const admin = await loginAs("admin@chicoplug.ao", "Password1");
      const response = await admin.post("/api/admin/stock/adjust").send({
        adjustments: [{ variantId: catalog.variantId, quantity: 42, mode: "set" }],
      });

      expect(response.status).toBe(200);
      const variant = await prisma.productVariant.findUniqueOrThrow({
        where: { id: catalog.variantId },
      });
      expect(variant.stock).toBe(42);
    });

    it("ajusta o stock em modo delta", async () => {
      const admin = await loginAs("admin@chicoplug.ao", "Password1");
      await admin.post("/api/admin/stock/adjust").send({
        adjustments: [{ variantId: catalog.variantId, quantity: -4, mode: "delta" }],
      });

      const variant = await prisma.productVariant.findUniqueOrThrow({
        where: { id: catalog.variantId },
      });
      expect(variant.stock).toBe(catalog.variantStock - 4);
    });

    it("recusa ajustes que deixariam stock negativo", async () => {
      const admin = await loginAs("admin@chicoplug.ao", "Password1");
      const response = await admin.post("/api/admin/stock/adjust").send({
        adjustments: [{ variantId: catalog.variantId, quantity: -999, mode: "delta" }],
      });

      expect(response.status).toBe(400);
      const variant = await prisma.productVariant.findUniqueOrThrow({
        where: { id: catalog.variantId },
      });
      expect(variant.stock).toBe(catalog.variantStock);
    });

    it("lista alertas de stock baixo", async () => {
      const admin = await loginAs("admin@chicoplug.ao", "Password1");
      const response = await admin.get("/api/admin/stock/alerts");

      expect(response.status).toBe(200);
      // A variante com stock 1 está abaixo do limiar de 6.
      expect(response.body.critical).toBeGreaterThanOrEqual(1);
    });

    it("arquiva em vez de apagar produtos já vendidos", async () => {
      const client = await cartWith(1);
      await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);

      const admin = await loginAs("admin@chicoplug.ao", "Password1");
      const response = await admin.delete(`/api/admin/products/${catalog.productId}`);

      expect(response.body.archived).toBe(true);
      const product = await prisma.product.findUniqueOrThrow({
        where: { id: catalog.productId },
      });
      expect(product.active).toBe(false);
    });

    it("recusa apagar categorias com produtos", async () => {
      const admin = await loginAs("admin@chicoplug.ao", "Password1");
      const response = await admin.delete(`/api/admin/categories/${catalog.categoryId}`);

      expect(response.status).toBe(409);
    });

    it("calcula métricas reais no dashboard", async () => {
      const client = await cartWith(2);
      await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);

      const admin = await loginAs("admin@chicoplug.ao", "Password1");
      const response = await admin.get("/api/admin/dashboard");

      expect(response.body.metrics.orders30d).toBe(1);
      expect(response.body.metrics.revenue30d).toBe(100000);
      expect(response.body.recentOrders).toHaveLength(1);
    });

    it("exclui encomendas canceladas da receita", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });
      const client = await loginAs("ana@chicoplug.ao", "Password1");
      await client.post("/api/cart/items").send({ variantId: catalog.variantId, quantity: 2 });
      const checkout = await client.post("/api/orders/checkout").send(CHECKOUT_INPUT);
      await client.post(`/api/orders/${checkout.body.order.reference}/cancel`);

      const admin = await loginAs("admin@chicoplug.ao", "Password1");
      const response = await admin.get("/api/admin/dashboard");

      expect(response.body.metrics.revenue30d).toBe(0);
    });
  });
});
