import p1 from "@/assets/p1.jpg";
import p2 from "@/assets/p2.jpg";
import p3 from "@/assets/p3.jpg";
import p4 from "@/assets/p4.jpg";
import p5 from "@/assets/p5.jpg";
import p6 from "@/assets/p6.jpg";
import editorial1 from "@/assets/editorial-1.jpg";
import editorial2 from "@/assets/editorial-2.jpg";

export const IMAGES = { p1, p2, p3, p4, p5, p6, editorial1, editorial2 };

export type ColorOption = { name: string; hex: string };

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
  badge?: "NOVO" | "DROP" | "ESGOTADO" | "ÚLTIMAS UNIDADES";
  stock: number;
  isNew?: boolean;
  isDrop?: boolean;
  bestSeller?: boolean;
  description: string;
  details: string[];
};

export const CATEGORIES = [
  "Hoodies",
  "T-Shirts",
  "Calças",
  "Outerwear",
  "Denim",
  "Acessórios",
] as const;

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

const BLACK: ColorOption = { name: "Preto", hex: "#111111" };
const WHITE: ColorOption = { name: "Branco", hex: "#FFFFFF" };
const GREY: ColorOption = { name: "Cinzento", hex: "#9A9A9A" };
const BLUE: ColorOption = { name: "Azul Claro", hex: "#A8D2E8" };

export const COLORS: ColorOption[] = [BLACK, WHITE, GREY, BLUE];

export const PRODUCTS: Product[] = [
  {
    id: "1",
    slug: "hoodie-heavyweight-noir",
    name: "Hoodie Heavyweight Noir",
    price: 78000,
    category: "Hoodies",
    collection: "vol-01-concreto",
    colors: [BLACK, GREY],
    sizes: ["S", "M", "L", "XL", "XXL"],
    images: [p1, editorial2, p3],
    badge: "DROP",
    stock: 12,
    isDrop: true,
    bestSeller: true,
    isNew: true,
    description:
      "Hoodie oversized em felpo 480gsm, lavagem pigmentada e interior escovado. Silhueta boxy com ombro descaído.",
    details: ["100% algodão 480gsm", "Corte oversized", "Lavagem pigmentada", "Produção limitada"],
  },
  {
    id: "2",
    slug: "tee-blank-essential",
    name: "Tee Blank Essential",
    price: 32000,
    compareAt: 39000,
    category: "T-Shirts",
    collection: "essentials",
    colors: [WHITE, BLACK, GREY],
    sizes: ["XS", "S", "M", "L", "XL"],
    images: [p2, editorial1, p6],
    badge: "NOVO",
    stock: 40,
    isNew: true,
    bestSeller: true,
    description:
      "T-shirt boxy em jersey compacto 240gsm. Gola reforçada, caimento estruturado, etiqueta tecida discreta.",
    details: ["Jersey 240gsm", "Gola reforçada", "Corte boxy", "Feito para durar"],
  },
  {
    id: "3",
    slug: "sweatpants-wide-ash",
    name: "Sweatpants Wide Ash",
    price: 64000,
    category: "Calças",
    collection: "vol-01-concreto",
    colors: [GREY, BLACK],
    sizes: ["S", "M", "L", "XL"],
    images: [p3, p1, editorial2],
    stock: 6,
    badge: "ÚLTIMAS UNIDADES",
    bestSeller: true,
    description:
      "Calças wide leg em felpo escovado, cintura elástica com cordão plano e bolsos laterais profundos.",
    details: ["Felpo 420gsm", "Wide leg", "Cintura elástica", "Bolsos laterais"],
  },
  {
    id: "4",
    slug: "bomber-nylon-midnight",
    name: "Bomber Nylon Midnight",
    price: 142000,
    category: "Outerwear",
    collection: "night-shift",
    colors: [BLACK],
    sizes: ["S", "M", "L", "XL"],
    images: [p4, editorial1, p2],
    badge: "DROP",
    stock: 4,
    isDrop: true,
    description:
      "Bomber em nylon mate com forro acolchoado, faixa contrastante nas mangas e bolso utilitário com zíper.",
    details: ["Nylon mate", "Forro acolchoado", "Zíper YKK", "Bolso utilitário"],
  },
  {
    id: "5",
    slug: "denim-jacket-faded-blue",
    name: "Denim Jacket Faded Blue",
    price: 118000,
    category: "Denim",
    collection: "night-shift",
    colors: [BLUE],
    sizes: ["S", "M", "L", "XL"],
    images: [p5, editorial1, p2],
    stock: 0,
    badge: "ESGOTADO",
    isNew: true,
    description:
      "Jaqueta em denim rígido 13oz com lavagem clara feita à mão. Costuras contrastantes e botões metálicos envelhecidos.",
    details: ["Denim 13oz", "Lavagem manual", "Botões envelhecidos", "Unissexo"],
  },
  {
    id: "6",
    slug: "headwear-set-static",
    name: "Headwear Set Static",
    price: 26000,
    category: "Acessórios",
    collection: "essentials",
    colors: [GREY, BLACK],
    sizes: ["S", "M", "L"],
    images: [p6, p2, editorial2],
    stock: 22,
    bestSeller: true,
    description: "Gorro em lã canelada e boné de sarja com etiqueta tecida. Vendidos individualmente.",
    details: ["Lã canelada", "Sarja de algodão", "Etiqueta tecida", "Tamanho único ajustável"],
  },
];

export type Collection = {
  slug: string;
  name: string;
  season: string;
  image: string;
  pieces: number;
  description: string;
};

export const COLLECTIONS: Collection[] = [
  {
    slug: "vol-01-concreto",
    name: "Vol. 01 — Concreto",
    season: "Drop 01 / 2026",
    image: editorial2,
    pieces: 12,
    description:
      "Peças pesadas, tons de cimento e lavagens que envelhecem contigo. A base do vestuário CHICOPLUG.",
  },
  {
    slug: "night-shift",
    name: "Night Shift",
    season: "Drop 02 / 2026",
    image: editorial1,
    pieces: 8,
    description: "Outerwear técnico para as horas em que a cidade não dorme. Preto sobre preto.",
  },
  {
    slug: "essentials",
    name: "Essentials",
    season: "Permanente",
    image: p2,
    pieces: 16,
    description: "O núcleo permanente. Cortes limpos, gramagens honestas, reposição contínua.",
  },
];

export const formatKz = (value: number) =>
  new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 0 }).format(value) + " Kz";

export const getProduct = (slug: string) => PRODUCTS.find((p) => p.slug === slug);

export type CartLine = {
  product: Product;
  size: string;
  color: string;
  quantity: number;
};

/** Carrinho de demonstração — sem lógica de estado global (pronto para backend). */
export const DEMO_CART: CartLine[] = PRODUCTS.slice(0, 2).map((product, i) => ({
  product,
  size: i === 0 ? "L" : "M",
  color: product.colors[0]?.name ?? "Preto",
  quantity: i === 0 ? 1 : 2,
}));

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