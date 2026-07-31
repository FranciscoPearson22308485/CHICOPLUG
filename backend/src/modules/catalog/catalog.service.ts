import type { Prisma } from "@prisma/client";

import { notFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import {
  productInclude,
  serializeCategory,
  serializeCollection,
  serializeProduct,
  type SerializedCategory,
  type SerializedCollection,
  type SerializedProduct,
} from "./catalog.serializer.js";
import type { ProductQuery } from "./catalog.schemas.js";

export type ProductListResult = {
  products: SerializedProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: {
    categories: string[];
    sizes: string[];
    colors: Array<{ name: string; hex: string }>;
    priceRange: { min: number; max: number };
  };
};

function buildWhere(query: ProductQuery): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ active: true }];

  if (query.search) {
    // `mode: "insensitive"` porque procurar "hoodie" tem de encontrar "Hoodie".
    and.push({
      OR: [
        { name: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { category: { name: { contains: query.search, mode: "insensitive" } } },
      ],
    });
  }

  if (query.category?.length) {
    and.push({
      OR: [
        { category: { slug: { in: query.category } } },
        { category: { name: { in: query.category } } },
      ],
    });
  }

  if (query.collection) and.push({ collection: { slug: query.collection } });

  if (query.size?.length) {
    and.push({ variants: { some: { size: { in: query.size }, active: true } } });
  }

  if (query.color?.length) {
    and.push({ variants: { some: { colorName: { in: query.color }, active: true } } });
  }

  if (query.minPrice !== undefined) and.push({ price: { gte: query.minPrice } });
  if (query.maxPrice !== undefined) and.push({ price: { lte: query.maxPrice } });

  if (query.inStock) and.push({ variants: { some: { stock: { gt: 0 }, active: true } } });
  if (query.isNew) and.push({ isNew: true });
  if (query.isDrop) and.push({ isDrop: true });
  if (query.bestSeller) and.push({ bestSeller: true });

  return { AND: and };
}

function buildOrderBy(sort: ProductQuery["sort"]): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "preco-asc":
      return [{ price: "asc" }, { name: "asc" }];
    case "preco-desc":
      return [{ price: "desc" }, { name: "asc" }];
    case "nome":
      return [{ name: "asc" }];
    case "novidades":
    default:
      // Espelha o `sort` do frontend: novidades primeiro, depois recência.
      return [{ isNew: "desc" }, { createdAt: "desc" }];
  }
}

export async function listProducts(query: ProductQuery): Promise<ProductListResult> {
  const where = buildWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: buildOrderBy(query.sort),
      skip,
      take: query.pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: rows.map(serializeProduct),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    facets: await getFacets(),
  };
}

/**
 * As facetas descrevem o catálogo **inteiro**, não o resultado filtrado: se
 * fossem calculadas sobre o resultado, escolher "Hoodies" faria desaparecer
 * todas as outras categorias e o utilizador ficaria sem forma de mudar de ideias.
 */
export async function getFacets(): Promise<ProductListResult["facets"]> {
  const [categories, variants, priceAgg] = await Promise.all([
    prisma.category.findMany({
      where: { active: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { name: true },
    }),
    prisma.productVariant.findMany({
      where: { active: true, product: { active: true } },
      select: { size: true, colorName: true, colorHex: true },
      distinct: ["size", "colorName"],
    }),
    prisma.product.aggregate({
      where: { active: true },
      _min: { price: true },
      _max: { price: true },
    }),
  ]);

  const sizes: string[] = [];
  const colors: Array<{ name: string; hex: string }> = [];
  for (const v of variants) {
    if (!sizes.includes(v.size)) sizes.push(v.size);
    if (!colors.some((c) => c.name === v.colorName)) {
      colors.push({ name: v.colorName, hex: v.colorHex });
    }
  }

  return {
    categories: categories.map((c) => c.name),
    sizes,
    colors,
    priceRange: { min: priceAgg._min.price ?? 0, max: priceAgg._max.price ?? 0 },
  };
}

export async function getProductBySlug(slug: string): Promise<SerializedProduct> {
  const product = await prisma.product.findFirst({
    where: { slug, active: true },
    include: productInclude,
  });
  if (!product) throw notFound("Peça não encontrada.");
  return serializeProduct(product);
}

/** Peças relacionadas: mesma colecção primeiro, depois mesma categoria. */
export async function getRelatedProducts(slug: string, limit = 3): Promise<SerializedProduct[]> {
  const product = await prisma.product.findUnique({
    where: { slug },
    select: { id: true, categoryId: true, collectionId: true },
  });
  if (!product) throw notFound("Peça não encontrada.");

  const sameCollection = product.collectionId
    ? await prisma.product.findMany({
        where: {
          active: true,
          id: { not: product.id },
          collectionId: product.collectionId,
        },
        include: productInclude,
        take: limit,
      })
    : [];

  if (sameCollection.length >= limit) {
    return sameCollection.slice(0, limit).map(serializeProduct);
  }

  const fill = await prisma.product.findMany({
    where: {
      active: true,
      id: { notIn: [product.id, ...sameCollection.map((p) => p.id)] },
      categoryId: product.categoryId,
    },
    include: productInclude,
    take: limit - sameCollection.length,
  });

  const combined = [...sameCollection, ...fill];

  // Ainda sem chegar ao limite: completa com o que houver de mais recente.
  if (combined.length < limit) {
    const extra = await prisma.product.findMany({
      where: { active: true, id: { notIn: [product.id, ...combined.map((p) => p.id)] } },
      include: productInclude,
      orderBy: { createdAt: "desc" },
      take: limit - combined.length,
    });
    combined.push(...extra);
  }

  return combined.map(serializeProduct);
}

export async function listCategories(): Promise<SerializedCategory[]> {
  const rows = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: { where: { active: true } } } } },
  });
  return rows.map(serializeCategory);
}

export async function listCollections(): Promise<SerializedCollection[]> {
  const rows = await prisma.collection.findMany({
    where: { active: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: { where: { active: true } } } } },
  });
  return rows.map(serializeCollection);
}

export async function getCollectionBySlug(slug: string): Promise<{
  collection: SerializedCollection;
  products: SerializedProduct[];
}> {
  const collection = await prisma.collection.findFirst({
    where: { slug, active: true },
    include: { _count: { select: { products: { where: { active: true } } } } },
  });
  if (!collection) throw notFound("Colecção não encontrada.");

  const products = await prisma.product.findMany({
    where: { active: true, collectionId: collection.id },
    include: productInclude,
    orderBy: [{ isNew: "desc" }, { createdAt: "desc" }],
  });

  return {
    collection: serializeCollection(collection),
    products: products.map(serializeProduct),
  };
}

/** Alimenta a homepage: novidades, drops e best sellers numa só chamada. */
export async function getHomeFeed(): Promise<{
  featured: SerializedProduct[];
  drops: SerializedProduct[];
  bestSellers: SerializedProduct[];
  collections: SerializedCollection[];
}> {
  const [featured, drops, bestSellers, collections] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, isNew: true },
      include: productInclude,
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.product.findMany({
      where: { active: true, isDrop: true },
      include: productInclude,
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.product.findMany({
      where: { active: true, bestSeller: true },
      include: productInclude,
      take: 6,
    }),
    listCollections(),
  ]);

  return {
    featured: featured.map(serializeProduct),
    drops: drops.map(serializeProduct),
    bestSellers: bestSellers.map(serializeProduct),
    collections,
  };
}

/** Sugestões da barra de pesquisa — deliberadamente leve. */
export async function searchSuggestions(term: string, limit = 6): Promise<SerializedProduct[]> {
  if (term.trim().length < 2) return [];
  const rows = await prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { category: { name: { contains: term, mode: "insensitive" } } },
      ],
    },
    include: productInclude,
    take: limit,
  });
  return rows.map(serializeProduct);
}
