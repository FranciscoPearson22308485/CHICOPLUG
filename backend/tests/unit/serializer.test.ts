import { describe, expect, it } from "vitest";

import {
  serializeProduct,
  type ProductWithRelations,
} from "../../src/modules/catalog/catalog.serializer.js";

function makeProduct(overrides: Partial<ProductWithRelations> = {}): ProductWithRelations {
  const now = new Date();
  return {
    id: "p1",
    slug: "hoodie",
    name: "Hoodie",
    description: "Descrição",
    details: ["Algodão"],
    price: 78000,
    compareAt: null,
    categoryId: "cat1",
    collectionId: "col1",
    badge: null,
    isNew: false,
    isDrop: false,
    bestSeller: false,
    active: true,
    metaTitle: null,
    metaDescription: null,
    createdAt: now,
    updatedAt: now,
    category: {
      id: "cat1",
      slug: "hoodies",
      name: "Hoodies",
      description: null,
      position: 0,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    collection: {
      id: "col1",
      slug: "vol-01",
      name: "Vol. 01",
      season: "Drop 01",
      description: null,
      imageUrl: null,
      imagePublicId: null,
      position: 0,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    images: [],
    variants: [],
    ...overrides,
  } as ProductWithRelations;
}

function makeVariant(size: string, colorName: string, stock: number, active = true) {
  const now = new Date();
  return {
    id: `${size}-${colorName}`,
    productId: "p1",
    size,
    colorName,
    colorHex: "#111111",
    sku: `SKU-${size}-${colorName}`,
    stock,
    lowStockThreshold: 6,
    priceOverride: null,
    active,
    createdAt: now,
    updatedAt: now,
  };
}

describe("serialização de produtos", () => {
  it("soma o stock das variantes activas", () => {
    const product = makeProduct({
      variants: [
        makeVariant("S", "Preto", 3),
        makeVariant("M", "Preto", 5),
        makeVariant("L", "Cinzento", 4),
      ] as never,
    });

    expect(serializeProduct(product).stock).toBe(12);
  });

  it("ignora variantes inactivas no stock e nas opções", () => {
    const product = makeProduct({
      variants: [
        makeVariant("S", "Preto", 3),
        makeVariant("XXL", "Azul", 99, false),
      ] as never,
    });

    const result = serializeProduct(product);
    expect(result.stock).toBe(3);
    expect(result.sizes).toEqual(["S"]);
    expect(result.colors.map((c) => c.name)).toEqual(["Preto"]);
  });

  it("desdobra as variantes em listas de tamanhos e cores sem repetições", () => {
    const product = makeProduct({
      variants: [
        makeVariant("S", "Preto", 1),
        makeVariant("M", "Preto", 1),
        makeVariant("S", "Cinzento", 1),
      ] as never,
    });

    const result = serializeProduct(product);
    expect(result.sizes).toEqual(["S", "M"]);
    expect(result.colors.map((c) => c.name)).toEqual(["Preto", "Cinzento"]);
  });

  it("marca ESGOTADO quando não há stock, sobrepondo-se ao distintivo definido", () => {
    const product = makeProduct({
      badge: "DROP",
      variants: [makeVariant("S", "Preto", 0)] as never,
    });

    expect(serializeProduct(product).badge).toBe("ESGOTADO");
  });

  it("mantém o distintivo definido quando há stock", () => {
    const product = makeProduct({
      badge: "DROP",
      variants: [makeVariant("S", "Preto", 4)] as never,
    });

    expect(serializeProduct(product).badge).toBe("DROP");
  });

  it("traduz ULTIMAS_UNIDADES para o rótulo acentuado que a UI espera", () => {
    const product = makeProduct({
      badge: "ULTIMAS_UNIDADES",
      variants: [makeVariant("S", "Preto", 2)] as never,
    });

    expect(serializeProduct(product).badge).toBe("ÚLTIMAS UNIDADES");
  });

  it("expõe a chave do enum além do rótulo, para a edição no admin", () => {
    // Regressão: o formulário do admin só recebia o rótulo acentuado e não
    // conseguia repor o valor guardado, apagando o distintivo em cada edição.
    const product = makeProduct({
      badge: "ULTIMAS_UNIDADES",
      variants: [makeVariant("S", "Preto", 2)] as never,
    });

    const result = serializeProduct(product);
    expect(result.badge).toBe("ÚLTIMAS UNIDADES");
    expect(result.badgeKey).toBe("ULTIMAS_UNIDADES");
  });

  it("mantém badgeKey mesmo quando o rótulo passa a ESGOTADO", () => {
    // Sem stock a UI mostra "ESGOTADO", mas o valor configurado tem de
    // sobreviver para o admin não o perder ao gravar.
    const product = makeProduct({
      badge: "DROP",
      variants: [makeVariant("S", "Preto", 0)] as never,
    });

    const result = serializeProduct(product);
    expect(result.badge).toBe("ESGOTADO");
    expect(result.badgeKey).toBe("DROP");
  });

  it("devolve badgeKey nulo quando não há distintivo", () => {
    const product = makeProduct({ variants: [makeVariant("S", "Preto", 1)] as never });
    expect(serializeProduct(product).badgeKey).toBeNull();
  });

  it("expõe o limiar de stock baixo da variante", () => {
    const product = makeProduct({ variants: [makeVariant("S", "Preto", 5)] as never });
    expect(serializeProduct(product).variants[0]?.lowStockThreshold).toBe(6);
  });

  it("omite compareAt quando não está definido", () => {
    const product = makeProduct({ variants: [makeVariant("S", "Preto", 1)] as never });
    expect(serializeProduct(product)).not.toHaveProperty("compareAt");
  });

  it("assinala stock baixo ao nível da variante", () => {
    const product = makeProduct({
      variants: [makeVariant("S", "Preto", 2), makeVariant("M", "Preto", 30)] as never,
    });

    const result = serializeProduct(product);
    expect(result.variants[0]?.lowStock).toBe(true);
    expect(result.variants[1]?.lowStock).toBe(false);
  });

  it("ordena as imagens pela posição definida", () => {
    const product = makeProduct({
      images: [
        { id: "i2", productId: "p1", url: "/b.webp", publicId: null, alt: null, position: 1, width: null, height: null, createdAt: new Date() },
        { id: "i1", productId: "p1", url: "/a.webp", publicId: null, alt: null, position: 0, width: null, height: null, createdAt: new Date() },
      ] as never,
      variants: [makeVariant("S", "Preto", 1)] as never,
    });

    expect(serializeProduct(product).images).toEqual(["/a.webp", "/b.webp"]);
  });
});
