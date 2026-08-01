import type { Brand, Category, Product, ProductImage, ProductVariant } from "@prisma/client";

/**
 * O frontend define `badge` como união de literais acentuados
 * ("ÚLTIMAS UNIDADES"); o Postgres guarda um enum sem acentos nem espaços.
 * Esta tabela é a fronteira entre os dois.
 */
const BADGE_LABEL = {
  NOVO: "NOVO",
  DROP: "DROP",
  ESGOTADO: "ESGOTADO",
  ULTIMAS_UNIDADES: "ÚLTIMAS UNIDADES",
} as const;

export type ProductWithRelations = Product & {
  category: Category;
  brand: Brand;
  images: ProductImage[];
  variants: ProductVariant[];
};

export type SerializedVariant = {
  id: string;
  size: string;
  colorName: string;
  colorHex: string;
  sku: string;
  stock: number;
  price: number;
  lowStock: boolean;
  lowStockThreshold: number;
  active: boolean;
};

/**
 * Forma devolvida ao frontend. Os primeiros campos replicam o tipo `Product`
 * original, para que os componentes existentes continuem a funcionar sem
 * alterações visuais. `brand` é o eixo novo da loja multimarca.
 */
export type SerializedProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAt?: number;
  /** Percentagem de desconto, já arredondada — usada nas etiquetas de promoção. */
  discountPercent?: number;
  category: string;
  categorySlug: string;
  brand: string;
  brandSlug: string;
  colors: Array<{ name: string; hex: string }>;
  sizes: string[];
  images: string[];
  badge?: string;
  badgeKey: string | null;
  stock: number;
  inStock: boolean;
  isNew?: boolean;
  isDrop?: boolean;
  bestSeller?: boolean;
  description: string;
  details: string[];
  variants: SerializedVariant[];
  metaTitle: string | null;
  metaDescription: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export function serializeVariant(variant: ProductVariant, productPrice: number): SerializedVariant {
  return {
    id: variant.id,
    size: variant.size,
    colorName: variant.colorName,
    colorHex: variant.colorHex,
    sku: variant.sku,
    stock: variant.stock,
    price: variant.priceOverride ?? productPrice,
    lowStock: variant.stock > 0 && variant.stock <= variant.lowStockThreshold,
    lowStockThreshold: variant.lowStockThreshold,
    active: variant.active,
  };
}

export function serializeProduct(product: ProductWithRelations): SerializedProduct {
  const activeVariants = product.variants.filter((v) => v.active);

  // O `stock` que a UI mostra é a soma das variantes — a fonte de verdade
  // continua a ser cada variante individualmente.
  const stock = activeVariants.reduce((sum, v) => sum + v.stock, 0);

  // Preserva a ordem de inserção: é a ordem por que o admin as criou e a que
  // faz sentido apresentar (S → XXL, não alfabética).
  const sizes: string[] = [];
  const colors: Array<{ name: string; hex: string }> = [];
  for (const variant of activeVariants) {
    if (!sizes.includes(variant.size)) sizes.push(variant.size);
    if (!colors.some((c) => c.name === variant.colorName)) {
      colors.push({ name: variant.colorName, hex: variant.colorHex });
    }
  }

  const images = [...product.images]
    .sort((a, b) => a.position - b.position)
    .map((image) => image.url);

  // Sem stock a etiqueta "ESGOTADO" ganha sempre, seja qual for a definida.
  const badge =
    stock === 0 ? BADGE_LABEL.ESGOTADO : product.badge ? BADGE_LABEL[product.badge] : undefined;

  const discountPercent =
    product.compareAt && product.compareAt > product.price
      ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100)
      : undefined;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    ...(product.compareAt !== null ? { compareAt: product.compareAt } : {}),
    ...(discountPercent ? { discountPercent } : {}),
    category: product.category.name,
    categorySlug: product.category.slug,
    brand: product.brand.name,
    brandSlug: product.brand.slug,
    colors,
    sizes,
    images,
    ...(badge ? { badge } : {}),
    badgeKey: product.badge,
    stock,
    inStock: stock > 0,
    ...(product.isNew ? { isNew: true } : {}),
    ...(product.isDrop ? { isDrop: true } : {}),
    ...(product.bestSeller ? { bestSeller: true } : {}),
    description: product.description,
    details: product.details,
    variants: activeVariants.map((v) => serializeVariant(v, product.price)),
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    active: product.active,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export const productInclude = {
  category: true,
  brand: true,
  images: { orderBy: { position: "asc" } },
  variants: { orderBy: { createdAt: "asc" } },
} as const;

export type SerializedBrand = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  image: string;
  logo: string | null;
  /** Número de peças disponíveis desta marca. */
  productCount: number;
  featured: boolean;
  active: boolean;
};

export function serializeBrand(
  brand: Brand & { _count?: { products: number } },
): SerializedBrand {
  return {
    id: brand.id,
    slug: brand.slug,
    name: brand.name,
    tagline: brand.tagline ?? "",
    description: brand.description ?? "",
    image: brand.imageUrl ?? "",
    logo: brand.logoUrl,
    productCount: brand._count?.products ?? 0,
    featured: brand.featured,
    active: brand.active,
  };
}

export type SerializedCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
  active: boolean;
  productCount: number;
  /** Imagem de uma peça da categoria, para a grelha de categorias da homepage. */
  image: string | null;
};

export function serializeCategory(
  category: Category & { _count?: { products: number }; products?: Array<{ images: ProductImage[] }> },
): SerializedCategory {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    position: category.position,
    active: category.active,
    productCount: category._count?.products ?? 0,
    image: category.products?.[0]?.images?.[0]?.url ?? null,
  };
}
