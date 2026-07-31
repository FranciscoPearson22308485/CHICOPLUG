import type {
  Category,
  Collection,
  Product,
  ProductImage,
  ProductVariant,
} from "@prisma/client";

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
  collection: Collection | null;
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
  /** Limiar de alerta, necessário para o formulário do admin o poder editar. */
  lowStockThreshold: number;
  active: boolean;
};

/**
 * Forma devolvida ao frontend. Os primeiros campos replicam exactamente o tipo
 * `Product` de `src/lib/catalog.ts` — os componentes existentes continuam a
 * funcionar sem uma única alteração. `variants` é aditivo: a página de produto
 * precisa dele para traduzir (tamanho, cor) no `variantId` que o carrinho usa.
 */
export type SerializedProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAt?: number;
  category: string;
  collection: string;
  colors: Array<{ name: string; hex: string }>;
  sizes: string[];
  images: string[];
  /** Rótulo apresentado na UI, já acentuado (ex.: "ÚLTIMAS UNIDADES"). */
  badge?: string;
  /**
   * Chave original do enum (ex.: "ULTIMAS_UNIDADES"), ou `null`.
   *
   * O `badge` acima é para mostrar; este é para editar. Sem ele, o formulário
   * do admin não conseguiria repor o valor guardado e gravaria `null` por
   * omissão — apagando o distintivo em cada edição.
   */
  badgeKey: string | null;
  stock: number;
  isNew?: boolean;
  isDrop?: boolean;
  bestSeller?: boolean;
  description: string;
  details: string[];
  // Campos adicionais (ignorados pelos componentes que não os usam).
  categorySlug: string;
  collectionSlug: string | null;
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

  // Preserva a ordem de inserção das variantes: é a ordem por que o admin as
  // criou e a que faz sentido apresentar (XS → XXL, não alfabética).
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
  const badge = stock === 0 ? BADGE_LABEL.ESGOTADO : product.badge ? BADGE_LABEL[product.badge] : undefined;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    ...(product.compareAt !== null ? { compareAt: product.compareAt } : {}),
    category: product.category.name,
    collection: product.collection?.slug ?? "",
    colors,
    sizes,
    images,
    ...(badge ? { badge } : {}),
    badgeKey: product.badge,
    stock,
    ...(product.isNew ? { isNew: true } : {}),
    ...(product.isDrop ? { isDrop: true } : {}),
    ...(product.bestSeller ? { bestSeller: true } : {}),
    description: product.description,
    details: product.details,

    categorySlug: product.category.slug,
    collectionSlug: product.collection?.slug ?? null,
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
  collection: true,
  images: { orderBy: { position: "asc" } },
  variants: { orderBy: { createdAt: "asc" } },
} as const;

export type SerializedCollection = {
  slug: string;
  name: string;
  season: string;
  image: string;
  pieces: number;
  description: string;
  id: string;
  active: boolean;
};

export function serializeCollection(
  collection: Collection & { _count?: { products: number } },
): SerializedCollection {
  return {
    id: collection.id,
    slug: collection.slug,
    name: collection.name,
    season: collection.season,
    image: collection.imageUrl ?? "",
    pieces: collection._count?.products ?? 0,
    description: collection.description ?? "",
    active: collection.active,
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
};

export function serializeCategory(
  category: Category & { _count?: { products: number } },
): SerializedCategory {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    position: category.position,
    active: category.active,
    productCount: category._count?.products ?? 0,
  };
}
