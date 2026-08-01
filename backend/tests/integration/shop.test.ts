import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createUser,
  loginAs,
  prisma,
  resetDatabase,
  seedCatalog,
  testClient,
  type SeededCatalog,
} from "../helpers.js";

describe("loja", () => {
  let catalog: SeededCatalog;

  beforeEach(async () => {
    await resetDatabase();
    catalog = await seedCatalog();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("catálogo", () => {
    it("lista produtos activos com facetas", async () => {
      const client = await testClient();
      const response = await client.get("/api/catalog/products");

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(1);
      expect(response.body.facets.categories.map((c: { name: string }) => c.name)).toContain("Hoodies");
      expect(response.body.facets.brands.map((b: { name: string }) => b.name)).toContain("Marca Teste");
    });

    it("soma o stock das variantes no produto", async () => {
      const client = await testClient();
      const response = await client.get(`/api/catalog/products/${catalog.productSlug}`);
      // 10 (M/Preto) + 1 (L/Preto)
      expect(response.body.product.stock).toBe(11);
    });

    it("expõe as variantes para a página resolver tamanho + cor", async () => {
      const client = await testClient();
      const response = await client.get(`/api/catalog/products/${catalog.productSlug}`);

      expect(response.body.product.variants).toHaveLength(2);
      expect(response.body.product.sizes).toEqual(["M", "L"]);
    });

    it("esconde produtos inactivos", async () => {
      await prisma.product.update({ where: { id: catalog.productId }, data: { active: false } });

      const client = await testClient();
      expect((await client.get("/api/catalog/products")).body.total).toBe(0);
      expect((await client.get(`/api/catalog/products/${catalog.productSlug}`)).status).toBe(404);
    });

    it("filtra por categoria", async () => {
      const client = await testClient();
      expect((await client.get("/api/catalog/products?category=Hoodies")).body.total).toBe(1);
      expect((await client.get("/api/catalog/products?category=Denim")).body.total).toBe(0);
    });

    it("filtra por tamanho e cor", async () => {
      const client = await testClient();
      expect((await client.get("/api/catalog/products?size=M")).body.total).toBe(1);
      expect((await client.get("/api/catalog/products?size=XXL")).body.total).toBe(0);
      expect((await client.get("/api/catalog/products?color=Preto")).body.total).toBe(1);
      expect((await client.get("/api/catalog/products?color=Amarelo")).body.total).toBe(0);
    });

    it("filtra por preço", async () => {
      const client = await testClient();
      expect((await client.get("/api/catalog/products?maxPrice=40000")).body.total).toBe(0);
      expect((await client.get("/api/catalog/products?maxPrice=60000")).body.total).toBe(1);
    });

    it("pesquisa por nome", async () => {
      const client = await testClient();
      expect((await client.get("/api/catalog/products?search=hoodie")).body.total).toBe(1);
      expect((await client.get("/api/catalog/products?search=inexistente")).body.total).toBe(0);
    });

    it("ordena por preço", async () => {
      await prisma.product.create({
        data: {
          slug: "tee-barata",
          name: "Tee Barata",
          description: "Tee",
          price: 10000,
          categoryId: catalog.categoryId,
          brandId: catalog.brandId,
          variants: {
            create: {
              size: "M",
              colorName: "Branco",
              colorHex: "#FFFFFF",
              sku: "CP-TEE-M-BRANCO",
              stock: 5,
            },
          },
        },
      });

      const client = await testClient();
      const asc = await client.get("/api/catalog/products?sort=preco-asc");
      const desc = await client.get("/api/catalog/products?sort=preco-desc");

      expect(asc.body.products[0].price).toBe(10000);
      expect(desc.body.products[0].price).toBe(50000);
    });

    it("devolve 404 para slug inexistente", async () => {
      const client = await testClient();
      expect((await client.get("/api/catalog/products/nao-existe")).status).toBe(404);
    });
  });

  describe("carrinho", () => {
    it("funciona sem conta, guardando a sessão em cookie", async () => {
      const client = await testClient();
      await client.post("/api/cart/items").send({ variantId: catalog.variantId, quantity: 2 });

      const response = await client.get("/api/cart");
      expect(response.body.cart.itemCount).toBe(2);
      expect(response.body.cart.subtotal).toBe(100000);
    });

    it("aplica envio grátis acima do limiar", async () => {
      const client = await testClient();

      // 1 × 50.000 fica abaixo dos 100.000 → paga envio.
      await client.post("/api/cart/items").send({ variantId: catalog.variantId, quantity: 1 });
      expect((await client.get("/api/cart")).body.cart.shipping).toBe(3500);

      // 2 × 50.000 = 100.000 → envio grátis.
      await client.post("/api/cart/items").send({ variantId: catalog.variantId, quantity: 1 });
      expect((await client.get("/api/cart")).body.cart.shipping).toBe(0);
    });

    it("soma quantidades ao adicionar a mesma variante", async () => {
      const client = await testClient();
      await client.post("/api/cart/items").send({ variantId: catalog.variantId, quantity: 2 });
      await client.post("/api/cart/items").send({ variantId: catalog.variantId, quantity: 3 });

      const response = await client.get("/api/cart");
      expect(response.body.cart.lines).toHaveLength(1);
      expect(response.body.cart.lines[0].quantity).toBe(5);
    });

    it("recusa mais unidades do que há em stock", async () => {
      const client = await testClient();
      const response = await client
        .post("/api/cart/items")
        .send({ variantId: catalog.scarceVariantId, quantity: 2 });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain("1 unidade");
    });

    it("aceita exactamente o stock disponível", async () => {
      const client = await testClient();
      const response = await client
        .post("/api/cart/items")
        .send({ variantId: catalog.scarceVariantId, quantity: 1 });

      expect(response.status).toBe(201);
    });

    it("trava a soma acumulada no stock disponível", async () => {
      const client = await testClient();
      await client.post("/api/cart/items").send({ variantId: catalog.scarceVariantId, quantity: 1 });
      const response = await client
        .post("/api/cart/items")
        .send({ variantId: catalog.scarceVariantId, quantity: 1 });

      expect(response.status).toBe(400);
    });

    it("remove a linha quando a quantidade chega a zero", async () => {
      const client = await testClient();
      const added = await client
        .post("/api/cart/items")
        .send({ variantId: catalog.variantId, quantity: 2 });

      const itemId = added.body.cart.lines[0].id;
      const response = await client.patch(`/api/cart/items/${itemId}`).send({ quantity: 0 });

      expect(response.body.cart.lines).toHaveLength(0);
    });

    it("funde o carrinho anónimo ao iniciar sessão", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });

      const client = await testClient();
      await client.post("/api/cart/items").send({ variantId: catalog.variantId, quantity: 2 });
      await client.post("/api/auth/login").send({ email: "ana@chicoplug.ao", password: "Password1" });

      // As peças escolhidas antes do login não podem desaparecer.
      expect((await client.get("/api/cart")).body.cart.itemCount).toBe(2);
    });

    it("mantém o carrinho entre sessões do mesmo utilizador", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });

      const primeira = await loginAs("ana@chicoplug.ao", "Password1");
      await primeira.post("/api/cart/items").send({ variantId: catalog.variantId, quantity: 2 });
      await primeira.post("/api/auth/logout");

      const segunda = await loginAs("ana@chicoplug.ao", "Password1");
      expect((await segunda.get("/api/cart")).body.cart.itemCount).toBe(2);
    });
  });

  describe("favoritos", () => {
    it("exige sessão", async () => {
      const client = await testClient();
      expect((await client.get("/api/wishlist")).status).toBe(401);
    });

    it("alterna o estado do favorito", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });
      const client = await loginAs("ana@chicoplug.ao", "Password1");

      const added = await client.post("/api/wishlist/toggle").send({ productId: catalog.productId });
      expect(added.body.added).toBe(true);

      const removed = await client
        .post("/api/wishlist/toggle")
        .send({ productId: catalog.productId });
      expect(removed.body.added).toBe(false);
    });

    it("lista os favoritos do utilizador", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });
      const client = await loginAs("ana@chicoplug.ao", "Password1");
      await client.post("/api/wishlist/toggle").send({ productId: catalog.productId });

      const response = await client.get("/api/wishlist");
      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0].slug).toBe(catalog.productSlug);
    });

    it("não mistura favoritos entre utilizadores", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });
      await createUser({ email: "nuno@chicoplug.ao", password: "Password1" });

      const ana = await loginAs("ana@chicoplug.ao", "Password1");
      await ana.post("/api/wishlist/toggle").send({ productId: catalog.productId });

      const nuno = await loginAs("nuno@chicoplug.ao", "Password1");
      expect((await nuno.get("/api/wishlist")).body.products).toHaveLength(0);
    });
  });

  describe("moradas", () => {
    it("marca a primeira morada como principal", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });
      const client = await loginAs("ana@chicoplug.ao", "Password1");

      const response = await client.post("/api/addresses").send({
        label: "Casa",
        recipientName: "Ana Miguel",
        phone: "+244900111222",
        province: "Luanda",
        municipality: "Talatona",
        street: "Rua Amílcar Cabral, 42",
      });

      expect(response.status).toBe(201);
      expect(response.body.address.isDefault).toBe(true);
    });

    it("garante uma única morada principal", async () => {
      await createUser({ email: "ana@chicoplug.ao", password: "Password1" });
      const client = await loginAs("ana@chicoplug.ao", "Password1");

      const base = {
        recipientName: "Ana Miguel",
        phone: "+244900111222",
        province: "Luanda",
        municipality: "Talatona",
        street: "Rua Teste",
      };

      await client.post("/api/addresses").send({ ...base, label: "Casa" });
      await client.post("/api/addresses").send({ ...base, label: "Trabalho", isDefault: true });

      const response = await client.get("/api/addresses");
      const principais = response.body.addresses.filter(
        (a: { isDefault: boolean }) => a.isDefault,
      );
      expect(principais).toHaveLength(1);
      expect(principais[0].label).toBe("Trabalho");
    });
  });
});

describe("marcas", () => {
  let catalog: SeededCatalog;

  beforeEach(async () => {
    await resetDatabase();
    catalog = await seedCatalog();
  });

  it("lista as marcas activas com contagem de peças", async () => {
    const client = await testClient();
    const response = await client.get("/api/catalog/brands");

    expect(response.status).toBe(200);
    expect(response.body.brands).toHaveLength(1);
    expect(response.body.brands[0].name).toBe("Marca Teste");
    expect(response.body.brands[0].productCount).toBe(1);
  });

  it("devolve só as marcas em destaque quando pedido", async () => {
    await prisma.brand.create({
      data: { name: "Sem Destaque", slug: "sem-destaque", featured: false },
    });

    const client = await testClient();
    const todas = await client.get("/api/catalog/brands");
    const destaque = await client.get("/api/catalog/brands?featured=true");

    expect(todas.body.brands).toHaveLength(2);
    expect(destaque.body.brands).toHaveLength(1);
  });

  it("mostra apenas os produtos da marca escolhida", async () => {
    const outra = await prisma.brand.create({
      data: { name: "Outra Marca", slug: "outra-marca" },
    });
    await prisma.product.create({
      data: {
        slug: "peca-outra",
        name: "Peça Outra",
        description: "Teste",
        price: 30000,
        categoryId: catalog.categoryId,
        brandId: outra.id,
        variants: {
          create: {
            size: "M",
            colorName: "Preto",
            colorHex: "#111111",
            sku: "CP-OUTRA-M-PRETO",
            stock: 3,
          },
        },
      },
    });

    const client = await testClient();
    const response = await client.get(`/api/catalog/brands/${catalog.brandSlug}`);

    expect(response.status).toBe(200);
    expect(response.body.products).toHaveLength(1);
    expect(response.body.products[0].brand).toBe("Marca Teste");
  });

  it("devolve 404 para marca inexistente", async () => {
    const client = await testClient();
    expect((await client.get("/api/catalog/brands/nao-existe")).status).toBe(404);
  });

  it("filtra o catálogo por marca", async () => {
    const client = await testClient();
    const hit = await client.get(`/api/catalog/products?brand=${catalog.brandSlug}`);
    const miss = await client.get("/api/catalog/products?brand=inexistente");

    expect(hit.body.total).toBe(1);
    expect(miss.body.total).toBe(0);
  });

  it("pesquisa por nome de marca", async () => {
    const client = await testClient();
    const response = await client.get("/api/catalog/products?search=Marca Teste");
    expect(response.body.total).toBe(1);
  });

  it("filtra por disponibilidade", async () => {
    await prisma.productVariant.updateMany({
      where: { productId: catalog.productId },
      data: { stock: 0 },
    });

    const client = await testClient();
    const comStock = await client.get("/api/catalog/products?inStock=true");
    const todos = await client.get("/api/catalog/products");

    expect(comStock.body.total).toBe(0);
    expect(todos.body.total).toBe(1);
  });

  it("filtra por promoção e calcula a percentagem de desconto", async () => {
    await prisma.product.update({
      where: { id: catalog.productId },
      data: { compareAt: 100000 },
    });

    const client = await testClient();
    const response = await client.get("/api/catalog/products?onSale=true");

    expect(response.body.total).toBe(1);
    // 50.000 sobre um anterior de 100.000 → 50% de desconto.
    expect(response.body.products[0].discountPercent).toBe(50);
  });

  it("lista as promoções no endpoint dedicado", async () => {
    await prisma.product.update({
      where: { id: catalog.productId },
      data: { compareAt: 80000 },
    });

    const client = await testClient();
    const response = await client.get("/api/catalog/promotions");
    expect(response.body.products).toHaveLength(1);
  });
});

describe("newsletter", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("regista uma inscrição", async () => {
    const client = await testClient();
    const response = await client
      .post("/api/newsletter/subscribe")
      .send({ email: "ana@chicoplug.ao", source: "home" });

    expect(response.status).toBe(201);
    expect(await prisma.newsletterSubscriber.count()).toBe(1);
  });

  it("é idempotente: reinscrever não é erro nem cria duplicados", async () => {
    const client = await testClient();
    await client.post("/api/newsletter/subscribe").send({ email: "ana@chicoplug.ao" });
    const segunda = await client.post("/api/newsletter/subscribe").send({ email: "ana@chicoplug.ao" });

    expect(segunda.status).toBe(201);
    expect(await prisma.newsletterSubscriber.count()).toBe(1);
  });

  it("reactiva quem se tinha removido", async () => {
    const client = await testClient();
    await client.post("/api/newsletter/subscribe").send({ email: "ana@chicoplug.ao" });
    await client.post("/api/newsletter/unsubscribe").send({ email: "ana@chicoplug.ao" });
    await client.post("/api/newsletter/subscribe").send({ email: "ana@chicoplug.ao" });

    const sub = await prisma.newsletterSubscriber.findUniqueOrThrow({
      where: { email: "ana@chicoplug.ao" },
    });
    expect(sub.active).toBe(true);
  });

  it("recusa emails inválidos", async () => {
    const client = await testClient();
    const response = await client.post("/api/newsletter/subscribe").send({ email: "nao-e-email" });
    expect(response.status).toBe(422);
  });

  it("exige perfil de administrador para listar subscritores", async () => {
    const client = await testClient();
    expect((await client.get("/api/newsletter")).status).toBe(401);
  });
});
