/**
 * Seed da loja CHICOPLUG.
 *
 * Reproduz fielmente o catálogo de demonstração de `frontend/src/lib/catalog.ts`
 * — mesmos nomes, preços, cores, tamanhos e textos — para que a loja ligada à
 * base fique visualmente idêntica ao protótipo do Lovable.
 *
 * As imagens são lidas de `frontend/src/assets`, optimizadas pelo mesmo pipeline
 * dos uploads do admin e gravadas em `backend/uploads`. Assim o catálogo tem
 * imagens reais servidas pela API, em vez de caminhos que só existiam no bundle
 * do Vite.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient, type ProductBadge } from "@prisma/client";

import { hashPassword } from "../src/lib/password.js";
import { buildSku, slugify } from "../src/lib/slug.js";
import { storeImage } from "../src/modules/uploads/storage.js";

const prisma = new PrismaClient();

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(HERE, "../../frontend/src/assets");

const BLACK = { name: "Preto", hex: "#111111" };
const WHITE = { name: "Branco", hex: "#FFFFFF" };
const GREY = { name: "Cinzento", hex: "#9A9A9A" };
const BLUE = { name: "Azul Claro", hex: "#A8D2E8" };

const CATEGORIES = [
  { name: "Hoodies", position: 0 },
  { name: "T-Shirts", position: 1 },
  { name: "Calças", position: 2 },
  { name: "Outerwear", position: 3 },
  { name: "Denim", position: 4 },
  { name: "Acessórios", position: 5 },
];

const COLLECTIONS = [
  {
    slug: "vol-01-concreto",
    name: "Vol. 01 — Concreto",
    season: "Drop 01 / 2026",
    asset: "editorial-2.jpg",
    position: 0,
    description:
      "Peças pesadas, tons de cimento e lavagens que envelhecem contigo. A base do vestuário CHICOPLUG.",
  },
  {
    slug: "night-shift",
    name: "Night Shift",
    season: "Drop 02 / 2026",
    asset: "editorial-1.jpg",
    position: 1,
    description:
      "Outerwear técnico para as horas em que a cidade não dorme. Preto sobre preto.",
  },
  {
    slug: "essentials",
    name: "Essentials",
    season: "Permanente",
    asset: "p2.jpg",
    position: 2,
    description: "O núcleo permanente. Cortes limpos, gramagens honestas, reposição contínua.",
  },
];

type SeedProduct = {
  slug: string;
  name: string;
  price: number;
  compareAt?: number;
  category: string;
  collection: string;
  colors: Array<{ name: string; hex: string }>;
  sizes: string[];
  assets: string[];
  badge?: ProductBadge;
  /** Stock total, distribuído pelas variantes. */
  stock: number;
  isNew?: boolean;
  isDrop?: boolean;
  bestSeller?: boolean;
  description: string;
  details: string[];
};

const PRODUCTS: SeedProduct[] = [
  {
    slug: "hoodie-heavyweight-noir",
    name: "Hoodie Heavyweight Noir",
    price: 78000,
    category: "Hoodies",
    collection: "vol-01-concreto",
    colors: [BLACK, GREY],
    sizes: ["S", "M", "L", "XL", "XXL"],
    assets: ["p1.jpg", "editorial-2.jpg", "p3.jpg"],
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
    slug: "tee-blank-essential",
    name: "Tee Blank Essential",
    price: 32000,
    compareAt: 39000,
    category: "T-Shirts",
    collection: "essentials",
    colors: [WHITE, BLACK, GREY],
    sizes: ["XS", "S", "M", "L", "XL"],
    assets: ["p2.jpg", "editorial-1.jpg", "p6.jpg"],
    badge: "NOVO",
    stock: 40,
    isNew: true,
    bestSeller: true,
    description:
      "T-shirt boxy em jersey compacto 240gsm. Gola reforçada, caimento estruturado, etiqueta tecida discreta.",
    details: ["Jersey 240gsm", "Gola reforçada", "Corte boxy", "Feito para durar"],
  },
  {
    slug: "sweatpants-wide-ash",
    name: "Sweatpants Wide Ash",
    price: 64000,
    category: "Calças",
    collection: "vol-01-concreto",
    colors: [GREY, BLACK],
    sizes: ["S", "M", "L", "XL"],
    assets: ["p3.jpg", "p1.jpg", "editorial-2.jpg"],
    badge: "ULTIMAS_UNIDADES",
    stock: 6,
    bestSeller: true,
    description:
      "Calças wide leg em felpo escovado, cintura elástica com cordão plano e bolsos laterais profundos.",
    details: ["Felpo 420gsm", "Wide leg", "Cintura elástica", "Bolsos laterais"],
  },
  {
    slug: "bomber-nylon-midnight",
    name: "Bomber Nylon Midnight",
    price: 142000,
    category: "Outerwear",
    collection: "night-shift",
    colors: [BLACK],
    sizes: ["S", "M", "L", "XL"],
    assets: ["p4.jpg", "editorial-1.jpg", "p2.jpg"],
    badge: "DROP",
    stock: 4,
    isDrop: true,
    description:
      "Bomber em nylon mate com forro acolchoado, faixa contrastante nas mangas e bolso utilitário com zíper.",
    details: ["Nylon mate", "Forro acolchoado", "Zíper YKK", "Bolso utilitário"],
  },
  {
    slug: "denim-jacket-faded-blue",
    name: "Denim Jacket Faded Blue",
    price: 118000,
    category: "Denim",
    collection: "night-shift",
    colors: [BLUE],
    sizes: ["S", "M", "L", "XL"],
    assets: ["p5.jpg", "editorial-1.jpg", "p2.jpg"],
    // Sem stock — exercita o estado "ESGOTADO" em toda a UI.
    stock: 0,
    isNew: true,
    description:
      "Jaqueta em denim rígido 13oz com lavagem clara feita à mão. Costuras contrastantes e botões metálicos envelhecidos.",
    details: ["Denim 13oz", "Lavagem manual", "Botões envelhecidos", "Unissexo"],
  },
  {
    slug: "headwear-set-static",
    name: "Headwear Set Static",
    price: 26000,
    category: "Acessórios",
    collection: "essentials",
    colors: [GREY, BLACK],
    sizes: ["S", "M", "L"],
    assets: ["p6.jpg", "p2.jpg", "editorial-2.jpg"],
    stock: 22,
    bestSeller: true,
    description:
      "Gorro em lã canelada e boné de sarja com etiqueta tecida. Vendidos individualmente.",
    details: ["Lã canelada", "Sarja de algodão", "Etiqueta tecida", "Tamanho único ajustável"],
  },
];

/** Cache: cada asset é optimizado uma vez, mesmo sendo usado por vários produtos. */
const imageCache = new Map<string, { url: string; publicId: string | null; width: number; height: number }>();

async function ingestAsset(
  filename: string,
  folder: "produtos" | "coleccoes",
): Promise<{ url: string; publicId: string | null; width: number; height: number } | null> {
  const cached = imageCache.get(filename);
  if (cached) return cached;

  try {
    const buffer = await fs.readFile(path.join(ASSETS, filename));
    const stored = await storeImage(buffer, folder);
    const value = {
      url: stored.url,
      publicId: stored.publicId,
      width: stored.width,
      height: stored.height,
    };
    imageCache.set(filename, value);
    return value;
  } catch (error) {
    console.warn(
      `  ! Não foi possível processar ${filename}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

/**
 * Reparte o stock total pelas variantes (tamanho × cor). Distribuímos de forma
 * uniforme e entregamos o resto às primeiras — assim a soma bate certo com o
 * `stock` do protótipo, que é o número que a UI mostra.
 */
function distributeStock(total: number, buckets: number): number[] {
  if (buckets === 0) return [];
  const base = Math.floor(total / buckets);
  const remainder = total % buckets;
  return Array.from({ length: buckets }, (_, i) => base + (i < remainder ? 1 : 0));
}

async function main(): Promise<void> {
  console.log("→ A limpar dados existentes…");
  // Ordem inversa das dependências; o resto cai por cascata.
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

  console.log("→ Categorias…");
  const categories = new Map<string, string>();
  for (const category of CATEGORIES) {
    const created = await prisma.category.create({
      data: { name: category.name, slug: slugify(category.name), position: category.position },
    });
    categories.set(category.name, created.id);
  }

  console.log("→ Colecções (a optimizar imagens)…");
  const collections = new Map<string, string>();
  for (const collection of COLLECTIONS) {
    const image = await ingestAsset(collection.asset, "coleccoes");
    const created = await prisma.collection.create({
      data: {
        slug: collection.slug,
        name: collection.name,
        season: collection.season,
        description: collection.description,
        imageUrl: image?.url ?? null,
        imagePublicId: image?.publicId ?? null,
        position: collection.position,
      },
    });
    collections.set(collection.slug, created.id);
  }

  console.log("→ Produtos e variantes…");
  for (const product of PRODUCTS) {
    const categoryId = categories.get(product.category);
    if (!categoryId) throw new Error(`Categoria em falta: ${product.category}`);

    const images = (
      await Promise.all(product.assets.map((asset) => ingestAsset(asset, "produtos")))
    ).filter((image): image is NonNullable<typeof image> => image !== null);

    const combos = product.sizes.flatMap((size) =>
      product.colors.map((color) => ({ size, color })),
    );
    const stockPerVariant = distributeStock(product.stock, combos.length);

    await prisma.product.create({
      data: {
        slug: product.slug,
        name: product.name,
        description: product.description,
        details: product.details,
        price: product.price,
        compareAt: product.compareAt ?? null,
        categoryId,
        collectionId: collections.get(product.collection) ?? null,
        badge: product.badge ?? null,
        isNew: product.isNew ?? false,
        isDrop: product.isDrop ?? false,
        bestSeller: product.bestSeller ?? false,
        metaTitle: `${product.name} — CHICOPLUG`,
        metaDescription: product.description.slice(0, 155),
        images: {
          create: images.map((image, index) => ({
            url: image.url,
            publicId: image.publicId,
            alt: `${product.name} — vista ${index + 1}`,
            position: index,
            width: image.width,
            height: image.height,
          })),
        },
        variants: {
          create: combos.map((combo, index) => ({
            size: combo.size,
            colorName: combo.color.name,
            colorHex: combo.color.hex,
            sku: `${buildSku(product.name, combo.size, combo.color.name)}-${String(index).padStart(2, "0")}`,
            stock: stockPerVariant[index] ?? 0,
            lowStockThreshold: 6,
          })),
        },
      },
    });

    console.log(`  · ${product.name} (${combos.length} variantes, ${product.stock} un.)`);
  }

  console.log("→ Contas…");
  const adminEmail = (process.env["SEED_ADMIN_EMAIL"] ?? "admin@chicoplug.ao").toLowerCase();
  const adminPassword = process.env["SEED_ADMIN_PASSWORD"] ?? "ChicoPlug!2026";

  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      firstName: "Chico",
      lastName: "Admin",
      role: "ADMIN",
      phone: "+244900000000",
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: "cliente@chicoplug.ao",
      passwordHash: await hashPassword("Cliente!2026"),
      firstName: "Chico",
      lastName: "Plug",
      phone: "+244900000001",
      addresses: {
        create: [
          {
            label: "Casa",
            recipientName: "Chico Plug",
            phone: "+244900000000",
            province: "Luanda",
            municipality: "Talatona",
            street: "Rua Amílcar Cabral, 42",
            isDefault: true,
          },
          {
            label: "Trabalho",
            recipientName: "Chico Plug",
            phone: "+244900111222",
            province: "Luanda",
            municipality: "Luanda",
            street: "Av. 4 de Fevereiro, 118, Ingombota",
          },
        ],
      },
    },
  });

  console.log("→ Cupões…");
  await prisma.coupon.createMany({
    data: [
      { code: "DROP10", type: "PERCENT", value: 10, minSubtotal: 50000, active: true },
      { code: "BEMVINDO", type: "FIXED", value: 5000, minSubtotal: 30000, maxRedemptions: 100, active: true },
    ],
  });

  console.log("\n✔ Seed concluído.");
  console.log(`  Admin:   ${adminEmail} / ${adminPassword}`);
  console.log(`  Cliente: cliente@chicoplug.ao / Cliente!2026 (id ${customer.id})`);
  console.log(`  ${PRODUCTS.length} produtos, ${imageCache.size} imagens optimizadas.`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed falhou:", error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
