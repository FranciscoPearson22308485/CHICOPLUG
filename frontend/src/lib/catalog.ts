import p1 from "@/assets/p1.jpg";
import p2 from "@/assets/p2.jpg";
import p3 from "@/assets/p3.jpg";
import p4 from "@/assets/p4.jpg";
import p5 from "@/assets/p5.jpg";
import p6 from "@/assets/p6.jpg";
import editorial1 from "@/assets/editorial-1.jpg";
import editorial2 from "@/assets/editorial-2.jpg";

/**
 * Imagens editoriais da marca (hero, secção "Nas ruas", bloco "A marca").
 * Não são catálogo — são arte fixa do site — por isso continuam a ser assets
 * locais em vez de virem da base de dados.
 */
export const IMAGES = { p1, p2, p3, p4, p5, p6, editorial1, editorial2 };

export type ColorOption = { name: string; hex: string };

/** Variante = combinação tamanho × cor. É onde vive o stock real. */
export type ProductVariant = {
  id: string;
  size: string;
  colorName: string;
  colorHex: string;
  sku: string;
  stock: number;
  price: number;
  lowStock: boolean;
  lowStockThreshold?: number;
  active: boolean;
};

/**
 * Produto tal como a API o devolve. Os primeiros campos são exactamente os que
 * o protótipo do Lovable já usava, para que `ProductCard`, a página de produto e
 * as grelhas continuem a funcionar sem qualquer alteração visual.
 */
export type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAt?: number;
  category: string;
  collection: string;
  colors: ColorOption[];
  sizes: string[];
  images: string[];
  badge?: string;
  /** Chave do enum, para o formulário do admin poder repor o valor. */
  badgeKey: string | null;
  stock: number;
  isNew?: boolean;
  isDrop?: boolean;
  bestSeller?: boolean;
  description: string;
  details: string[];

  categorySlug: string;
  collectionSlug: string | null;
  variants: ProductVariant[];
  metaTitle: string | null;
  metaDescription: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Collection = {
  id: string;
  slug: string;
  name: string;
  season: string;
  image: string;
  pieces: number;
  description: string;
  active: boolean;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
  active: boolean;
  productCount: number;
};

export type Facets = {
  categories: string[];
  sizes: string[];
  colors: ColorOption[];
  priceRange: { min: number; max: number };
};

export type CartLine = {
  id: string;
  variantId: string;
  product: Product;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  availableStock: number;
  exceedsStock: boolean;
};

export type Cart = {
  id: string;
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  shipping: number;
  total: number;
  freeShippingThreshold: number;
  amountToFreeShipping: number;
};

export type OrderStatus =
  | "NOVA"
  | "CONFIRMADA"
  | "EM_PREPARACAO"
  | "ENVIADA"
  | "ENTREGUE"
  | "CANCELADA";

export type PaymentStatus = "PENDENTE" | "PAGO" | "CANCELADO" | "FALHADO";

export type Order = {
  id: string;
  reference: string;
  status: OrderStatus;
  statusLabel: string;
  customerName: string;
  email: string;
  phone: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  shipping_address: {
    province: string;
    municipality: string;
    street: string;
    notes: string | null;
  };
  items: Array<{
    id: string;
    productName: string;
    productSlug: string;
    imageUrl: string | null;
    size: string;
    colorName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
  itemCount: number;
  payment: {
    id: string;
    provider: string;
    status: PaymentStatus;
    reference: string;
    amount: number;
    paidAt: string | null;
    failureReason: string | null;
  } | null;
  events: Array<{
    id: string;
    from: OrderStatus | null;
    to: OrderStatus;
    note: string | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  allowedTransitions?: Array<{ value: OrderStatus; label: string }>;
};

export type Address = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  province: string;
  municipality: string;
  street: string;
  notes: string | null;
  isDefault: boolean;
};

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: "USER" | "ADMIN";
  marketingOptIn: boolean;
  createdAt: string;
};

/**
 * Valores de recurso para a primeira pintura, antes de as facetas reais
 * chegarem da API. Mantêm o menu e os filtros com conteúdo em vez de piscarem
 * vazios — e são substituídos assim que a resposta chega.
 */
export const CATEGORIES = [
  "Hoodies",
  "T-Shirts",
  "Calças",
  "Outerwear",
  "Denim",
  "Acessórios",
] as const;

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export const COLORS: ColorOption[] = [
  { name: "Preto", hex: "#111111" },
  { name: "Branco", hex: "#FFFFFF" },
  { name: "Cinzento", hex: "#9A9A9A" },
  { name: "Azul Claro", hex: "#A8D2E8" },
];

export const formatKz = (value: number) =>
  new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 0 }).format(value) + " Kz";

export const PROVINCES = [
  "Luanda",
  "Benguela",
  "Huíla",
  "Huambo",
  "Cabinda",
  "Namibe",
  "Malanje",
  "Uíge",
];

export const MUNICIPALITIES: Record<string, string[]> = {
  Luanda: ["Belas", "Cacuaco", "Cazenga", "Icolo e Bengo", "Luanda", "Talatona", "Viana"],
  Benguela: ["Benguela", "Catumbela", "Lobito", "Baía Farta"],
  Huíla: ["Lubango", "Humpata", "Matala"],
  Huambo: ["Huambo", "Caála", "Bailundo"],
  Cabinda: ["Cabinda", "Cacongo"],
  Namibe: ["Moçâmedes", "Tômbwa"],
  Malanje: ["Malanje", "Cacuso"],
  Uíge: ["Uíge", "Negage"],
};

export const SIZE_GUIDE = [
  { size: "S", chest: "104 cm", length: "68 cm", shoulder: "52 cm" },
  { size: "M", chest: "110 cm", length: "70 cm", shoulder: "54 cm" },
  { size: "L", chest: "116 cm", length: "72 cm", shoulder: "56 cm" },
  { size: "XL", chest: "122 cm", length: "74 cm", shoulder: "58 cm" },
  { size: "XXL", chest: "128 cm", length: "76 cm", shoulder: "60 cm" },
];

/** Encontra a variante correspondente a um par (tamanho, cor). */
export function findVariant(
  product: Product,
  size: string | null,
  colorName: string,
): ProductVariant | undefined {
  if (!size) return undefined;
  return product.variants.find((v) => v.size === size && v.colorName === colorName);
}

/** Tamanhos com stock para a cor escolhida — permite desactivar os esgotados. */
export function availableSizesForColor(product: Product, colorName: string): Set<string> {
  return new Set(
    product.variants.filter((v) => v.colorName === colorName && v.stock > 0).map((v) => v.size),
  );
}
