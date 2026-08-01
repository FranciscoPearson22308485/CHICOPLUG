import type { Prisma } from "@prisma/client";

import { notFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import {
  productInclude,
  serializeBrand,
  serializeCategory,
  serializeProduct,
  type SerializedBrand,
  type SerializedCategory,
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
    brands: Array<{ name: string; slug: string; count: number }>;
    categories: Array<{ name: string; slug: string; count: number }>;
    sizes: string[];
    colors: Array<{ name: string; hex: string }>;
    priceRange: { min: number; max: number };
  };
};

function buildWhere(query: ProductQuery): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ active: true }];

  if (query.search) {
    // A pesquisa cobre marca, produto e categoria — os três eixos que um
    // cliente de boutique multimarca usa naturalmente.
    and.push({
      OR: [
        { name: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { brand: { name: { contains: query.search, mode: "insensitive" } } },
        { category: { name: { contains: query.search, mode: "insensitive" } } },
      ],
    });
  }

  if (query.brand?.length) {
    and.push({
      OR: [{ brand: { slug: { in: query.brand } } }, { brand: { name: { in: query.brand } } }],
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

  if (query.size?.length) {
    and.push({ variants: { some: { size: { in: query.size }, active: true } } });
  }

  if (query.color?.length) {
    and.push({ variants: { some: { colorName: { in: query.color }, active: true } } });
  }

  if (query.minPrice !== undefined) and.push({ price: { gte: query.minPrice } });
  if (query.maxPrice !== undefined) and.push({ price: { lte: query.maxPrice } });

  if (query.inStock) and.push({ variants: { some: { stock: { gt: 0 }, active: true } } });
  if (query.onSale) and.push({ compareAt: { not: null } });
  if (query.isNew) and.push({ isNew: true });
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
    case "marca":
      return [{ brand: { name: "asc" } }, { name: "asc" }];
    case "novidades":
    default:
      return [{ isNew: "desc" }, { createdAt: "desc" }];
  }
}

export async function listProducts(query: ProductQuery): Promise<ProductListResult> {
  const where = buildWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [rows, total, facets] = await Promise.all([
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: buildOrderBy(query.sort),
      skip,
      take: query.pageSize,
    }),
    prisma.product.count({ where }),
    getFacets(),
  ]);

  return {
    products: rows.map(serializeProduct),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    facets,
  };
}

/**
 * As facetas descrevem o catálogo **inteiro**, não o resultado filtrado: se
 * fossem calculadas sobre o resultado, escolher "Nike" faria desaparecer todas
 * as outras marcas e o utilizador ficava sem forma de mudar de ideias.
 */
export async function getFacets(): Promise<ProductListResult["facets"]> {
  const [brands, categories, variants, priceAgg] = await Promise.all([
    prisma.brand.findMany({
      where: { active: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: {
        name: true,
        slug: true,
        _count: { select: { products: { where: { active: true } } } },
      },
    }),
    prisma.category.findMany({
      where: { active: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: {
        name: true,
        slug: true,
        _count: { select: { products: { where: { active: true } } } },
      },
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
    // Marcas e categorias sem peças disponíveis não devem aparecer nos filtros.
    brands: brands
      .filter((b) => b._count.products > 0)
      .map((b) => ({ name: b.name, slug: b.slug, count: b._count.products })),
    categories: categories
      .filter((c) => c._count.products > 0)
      .map((c) => ({ name: c.name, slug: c.slug, count: c._count.products })),
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

/** Peças relacionadas: mesma marca primeiro, depois mesma categoria. */
export async function getRelatedProducts(slug: string, limit = 3): Promise<SerializedProduct[]> {
  const product = await prisma.product.findUnique({
    where: { slug },
    select: { id: true, categoryId: true, brandId: true },
  });
  if (!product) throw notFound("Peça não encontrada.");

  const sameBrand = await prisma.product.findMany({
    where: { active: true, id: { not: product.id }, brandId: product.brandId },
    include: productInclude,
    take: limit,
  });

  if (sameBrand.length >= limit) return sameBrand.slice(0, limit).map(serializeProduct);

  const sameCategory = await prisma.product.findMany({
    where: {
      active: true,
      id: { notIn: [product.id, ...sameBrand.map((p) => p.id)] },
      categoryId: product.categoryId,
    },
    include: productInclude,
    take: limit - sameBrand.length,
  });

  const combined = [...sameBrand, ...sameCategory];

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
    include: {
      _count: { select: { products: { where: { active: true } } } },
      // Uma imagem representativa para a grelha de categorias da homepage.
      products: {
        where: { active: true },
        take: 1,
        orderBy: { createdAt: "desc" },
        include: { images: { orderBy: { position: "asc" }, take: 1 } },
      },
    },
  });
  return rows.map(serializeCategory);
}

export async function listBrands(options: { featuredOnly?: boolean } = {}): Promise<
  SerializedBrand[]
> {
  const rows = await prisma.brand.findMany({
    where: { active: true, ...(options.featuredOnly ? { featured: true } : {}) },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: { where: { active: true } } } } },
  });
  return rows.map(serializeBrand);
}

export async function getBrandBySlug(slug: string): Promise<{
  brand: SerializedBrand;
  products: SerializedProduct[];
}> {
  const brand = await prisma.brand.findFirst({
    where: { slug, active: true },
    include: { _count: { select: { products: { where: { active: true } } } } },
  });
  if (!brand) throw notFound("Marca não encontrada.");

  const products = await prisma.product.findMany({
    where: { active: true, brandId: brand.id },
    include: productInclude,
    orderBy: [{ isNew: "desc" }, { createdAt: "desc" }],
  });

  return { brand: serializeBrand(brand), products: products.map(serializeProduct) };
}

/** Peças com preço comparativo — a secção de promoções da homepage. */
export async function listPromotions(limit = 8): Promise<SerializedProduct[]> {
  const rows = await prisma.product.findMany({
    where: { active: true, compareAt: { not: null } },
    include: productInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(serializeProduct);
}

/**
 * Alimenta a homepage numa só chamada, na ordem em que as secções aparecem:
 * novidades → marcas → mais vendidos → categorias → promoções.
 */
export async function getHomeFeed(): Promise<{
  newArrivals: SerializedProduct[];
  brands: SerializedBrand[];
  bestSellers: SerializedProduct[];
  categories: SerializedCategory[];
  promotions: SerializedProduct[];
}> {
  const [newArrivals, brands, bestSellers, categories, promotions] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, isNew: true },
      include: productInclude,
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    listBrands({ featuredOnly: true }),
    prisma.product.findMany({
      where: { active: true, bestSeller: true },
      include: productInclude,
      take: 8,
    }),
    listCategories(),
    listPromotions(8),
  ]);

  return {
    newArrivals: newArrivals.map(serializeProduct),
    brands,
    bestSellers: bestSellers.map(serializeProduct),
    categories,
    promotions,
  };
}

/** Sugestões da barra de pesquisa — marca, produto ou categoria. */
export async function searchSuggestions(
  term: string,
  limit = 6,
): Promise<{ products: SerializedProduct[]; brands: SerializedBrand[] }> {
  if (term.trim().length < 2) return { products: [], brands: [] };

  const [products, brands] = await Promise.all([
    prisma.product.findMany({
      where: {
        active: true,
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { brand: { name: { contains: term, mode: "insensitive" } } },
          { category: { name: { contains: term, mode: "insensitive" } } },
        ],
      },
      include: productInclude,
      take: limit,
    }),
    prisma.brand.findMany({
      where: { active: true, name: { contains: term, mode: "insensitive" } },
      include: { _count: { select: { products: { where: { active: true } } } } },
      take: 3,
    }),
  ]);

  return { products: products.map(serializeProduct), brands: brands.map(serializeBrand) };
}
