/**
 * Seed da CHICOPLUG — boutique multimarca de streetwear premium.
 *
 * A loja não fabrica roupa: cura e revende peças de marcas internacionais.
 * Este seed cria o catálogo de demonstração com marcas reais, categorias
 * completas e um conjunto de peças em promoção.
 *
 * As imagens vêm de `frontend/src/assets`, passam pelo mesmo pipeline de
 * optimização dos uploads do admin e ficam em `backend/uploads`.
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
const CREAM = { name: "Cru", hex: "#EDE7DC" };
const NAVY = { name: "Azul-marinho", hex: "#1B2A41" };

/** Categorias pedidas para a loja multimarca. */
const CATEGORIES = [
  "T-Shirts",
  "Hoodies",
  "Jeans",
  "Sneakers",
  "Calças",
  "Casacos",
  "Bonés",
  "Acessórios",
];

type SeedBrand = {
  name: string;
  tagline: string;
  description: string;
  asset?: string;
  featured: boolean;
};

const BRANDS: SeedBrand[] = [
  {
    name: "Nike",
    tagline: "Sportswear icónico desde 1964",
    description:
      "O maior nome do sportswear mundial. Silhuetas que atravessaram gerações e continuam a definir o que se veste na rua.",
    asset: "editorial-1.jpg",
    featured: true,
  },
  {
    name: "Jordan",
    tagline: "O legado que calçou o basquetebol",
    description:
      "Nascida no parquet, adoptada pela rua. A Jumpman é hoje tão cultural quanto desportiva.",
    asset: "p4.jpg",
    featured: true,
  },
  {
    name: "Adidas",
    tagline: "Três riscas, alcance global",
    description:
      "Do terreno de jogo ao streetwear. Peças reconhecíveis à distância, com o conforto de quem faz isto há décadas.",
    asset: "p2.jpg",
    featured: true,
  },
  {
    name: "Corteiz",
    tagline: "Londres, sem pedir licença",
    description:
      "A marca que fez do lançamento-relâmpago uma linguagem própria. Quantidades curtas, procura enorme.",
    asset: "editorial-2.jpg",
    featured: true,
  },
  {
    name: "Represent",
    tagline: "Alfaiataria aplicada ao streetwear",
    description:
      "Manchester. Gramagens pesadas e cortes trabalhados, num registo mais sóbrio do que o habitual no género.",
    asset: "p1.jpg",
    featured: true,
  },
  {
    name: "Hellstar",
    tagline: "Gráfica crua, atitude directa",
    description:
      "Estampados densos e uma estética que não procura agradar a todos. Das marcas mais procuradas da nova vaga.",
    asset: "p3.jpg",
    featured: true,
  },
  {
    name: "Denim Tears",
    tagline: "Denim com memória",
    description:
      "Tremaine Emory transformou o algodão num discurso sobre história e identidade. Peças com peso simbólico.",
    asset: "p5.jpg",
    featured: true,
  },
  {
    name: "Essentials",
    tagline: "O básico elevado",
    description:
      "A linha acessível da Fear of God. Paleta neutra, caimento generoso, o núcleo de qualquer guarda-roupa.",
    asset: "p6.jpg",
    featured: true,
  },
  {
    name: "Gallery Dept",
    tagline: "Arte vestível de Los Angeles",
    description:
      "Cada peça é intervencionada à mão. Nenhuma sai exactamente igual à anterior.",
    asset: "editorial-1.jpg",
    featured: false,
  },
];

type SeedProduct = {
  name: string;
  brand: string;
  category: string;
  price: number;
  /** Preço anterior — presente apenas nas peças em promoção. */
  compareAt?: number;
  colors: Array<{ name: string; hex: string }>;
  sizes: string[];
  assets: string[];
  badge?: ProductBadge;
  stock: number;
  isNew?: boolean;
  bestSeller?: boolean;
  description: string;
  details: string[];
};

/** Tamanhos de calçado, distintos do vestuário. */
const SNEAKER_SIZES = ["39", "40", "41", "42", "43", "44", "45"];
const APPAREL = ["S", "M", "L", "XL", "XXL"];
const APPAREL_WIDE = ["XS", "S", "M", "L", "XL"];
const WAIST = ["28", "30", "32", "34", "36"];
const ONE_SIZE = ["Tamanho único"];

const PRODUCTS: SeedProduct[] = [
  {
    name: "Nike Tech Fleece Hoodie",
    brand: "Nike",
    category: "Hoodies",
    price: 128000,
    colors: [BLACK, GREY],
    sizes: APPAREL,
    assets: ["p1.jpg", "editorial-2.jpg", "p3.jpg"],
    stock: 18,
    isNew: true,
    bestSeller: true,
    description:
      "O Tech Fleece continua a ser a referência em conforto térmico sem volume. Corte limpo, fecho integral e bolsos laterais com zíper.",
    details: ["Tecido Tech Fleece", "Fecho integral", "Bolsos com zíper", "Capuz forrado"],
  },
  {
    name: "Nike Air Force 1 '07",
    brand: "Nike",
    category: "Sneakers",
    price: 96000,
    compareAt: 118000,
    colors: [WHITE, BLACK],
    sizes: SNEAKER_SIZES,
    assets: ["p2.jpg", "p6.jpg", "editorial-1.jpg"],
    stock: 24,
    bestSeller: true,
    description:
      "O ténis que nunca saiu de circulação. Pele lisa, entressola Air e a silhueta que atravessou quatro décadas intacta.",
    details: ["Pele natural", "Amortecimento Nike Air", "Sola de borracha", "Modelo unissexo"],
  },
  {
    name: "Jordan Flight Essentials Tee",
    brand: "Jordan",
    category: "T-Shirts",
    price: 42000,
    colors: [WHITE, BLACK, GREY],
    sizes: APPAREL_WIDE,
    assets: ["p2.jpg", "editorial-1.jpg", "p6.jpg"],
    badge: "NOVO",
    stock: 36,
    isNew: true,
    description:
      "Jersey de algodão pesado com Jumpman bordado ao peito. Caimento descontraído sem perder estrutura.",
    details: ["100% algodão", "Jumpman bordado", "Corte descontraído", "Gola reforçada"],
  },
  {
    name: "Jordan 1 Mid",
    brand: "Jordan",
    category: "Sneakers",
    price: 152000,
    colors: [BLACK, WHITE],
    sizes: SNEAKER_SIZES,
    assets: ["p4.jpg", "editorial-1.jpg", "p2.jpg"],
    stock: 9,
    bestSeller: true,
    description:
      "A silhueta mais reconhecível do calçado desportivo, na altura intermédia. Pele de primeira e acabamentos cuidados.",
    details: ["Cabedal premium", "Cano médio", "Unidade Air encapsulada", "Ilhós metálicos"],
  },
  {
    name: "Adidas Originals Trefoil Hoodie",
    brand: "Adidas",
    category: "Hoodies",
    price: 88000,
    compareAt: 108000,
    colors: [GREY, BLACK, NAVY],
    sizes: APPAREL,
    assets: ["p3.jpg", "p1.jpg", "editorial-2.jpg"],
    stock: 21,
    description:
      "Felpo escovado com o Trefoil aplicado ao peito. O casaco de capuz que funciona em qualquer contexto.",
    details: ["Felpo de algodão", "Trefoil aplicado", "Bolso canguru", "Punhos canelados"],
  },
  {
    name: "Adidas Samba OG",
    brand: "Adidas",
    category: "Sneakers",
    price: 84000,
    colors: [WHITE, BLACK],
    sizes: SNEAKER_SIZES,
    assets: ["p6.jpg", "p2.jpg", "editorial-1.jpg"],
    stock: 15,
    isNew: true,
    bestSeller: true,
    description:
      "Do salão de futebol para a rua. Perfil baixo, biqueira em camurça e sola de goma — um clássico que voltou a dominar.",
    details: ["Pele e camurça", "Sola de goma", "Perfil baixo", "Modelo unissexo"],
  },
  {
    name: "Corteiz Alcatraz Cargo",
    brand: "Corteiz",
    category: "Calças",
    price: 116000,
    colors: [BLACK, GREY],
    sizes: APPAREL,
    assets: ["p3.jpg", "editorial-2.jpg", "p1.jpg"],
    badge: "ULTIMAS_UNIDADES",
    stock: 5,
    description:
      "Cargo de perna larga com bolsos utilitários e o logótipo Alcatraz aplicado. Produção sempre curta.",
    details: ["Sarja resistente", "Perna larga", "Bolsos utilitários", "Cintura ajustável"],
  },
  {
    name: "Corteiz 4Starz Tee",
    brand: "Corteiz",
    category: "T-Shirts",
    price: 54000,
    colors: [BLACK, WHITE],
    sizes: APPAREL,
    assets: ["p2.jpg", "p6.jpg", "editorial-1.jpg"],
    stock: 12,
    isNew: true,
    description:
      "Estampado 4Starz em serigrafia sobre jersey pesado. Uma das peças mais procuradas da marca.",
    details: ["Jersey 220gsm", "Serigrafia", "Corte boxy", "Etiqueta tecida"],
  },
  {
    name: "Represent Owners Club Hoodie",
    brand: "Represent",
    category: "Hoodies",
    price: 168000,
    colors: [CREAM, BLACK],
    sizes: APPAREL,
    assets: ["p1.jpg", "p3.jpg", "editorial-2.jpg"],
    stock: 8,
    bestSeller: true,
    description:
      "Felpo de 400gsm com lavagem pigmentada e o Owners Club aplicado em relevo. Envelhece bem com o uso.",
    details: ["Felpo 400gsm", "Lavagem pigmentada", "Aplicação em relevo", "Corte oversized"],
  },
  {
    name: "Represent Initial Jacket",
    brand: "Represent",
    category: "Casacos",
    price: 224000,
    colors: [BLACK],
    sizes: APPAREL,
    assets: ["p4.jpg", "editorial-1.jpg", "p2.jpg"],
    stock: 4,
    description:
      "Casaco em nylon mate com forro acolchoado e bolso utilitário. Estrutura pensada para durar estações.",
    details: ["Nylon mate", "Forro acolchoado", "Zíper YKK", "Bolso interior"],
  },
  {
    name: "Hellstar Studios Sweatpants",
    brand: "Hellstar",
    category: "Calças",
    price: 98000,
    compareAt: 124000,
    colors: [GREY, BLACK],
    sizes: APPAREL,
    assets: ["p3.jpg", "p1.jpg", "editorial-2.jpg"],
    stock: 11,
    description:
      "Calças de fato de treino em felpo escovado com gráfica aplicada na perna. Cintura elástica e cordão plano.",
    details: ["Felpo 420gsm", "Gráfica aplicada", "Cintura elástica", "Bolsos laterais"],
  },
  {
    name: "Hellstar Records Tee",
    brand: "Hellstar",
    category: "T-Shirts",
    price: 58000,
    colors: [BLACK, WHITE],
    sizes: APPAREL,
    assets: ["p2.jpg", "editorial-1.jpg", "p6.jpg"],
    badge: "NOVO",
    stock: 16,
    isNew: true,
    description:
      "Estampado integral frente e costas sobre algodão pesado. Uma das peças mais reconhecíveis da marca.",
    details: ["Algodão 240gsm", "Estampado frente e costas", "Corte largo", "Gola dupla"],
  },
  {
    name: "Denim Tears Cotton Wreath Jeans",
    brand: "Denim Tears",
    category: "Jeans",
    price: 186000,
    colors: [BLUE],
    sizes: WAIST,
    assets: ["p5.jpg", "editorial-1.jpg", "p2.jpg"],
    stock: 6,
    isNew: true,
    description:
      "Denim rígido com a coroa de algodão aplicada — o motivo que define a marca. Lavagem média, corte recto.",
    details: ["Denim 13oz", "Coroa de algodão aplicada", "Corte recto", "Botões metálicos"],
  },
  {
    name: "Denim Tears Trucker Jacket",
    brand: "Denim Tears",
    category: "Casacos",
    price: 212000,
    colors: [BLUE],
    sizes: APPAREL,
    assets: ["p5.jpg", "p2.jpg", "editorial-2.jpg"],
    // Sem stock: exercita o estado esgotado em toda a interface.
    stock: 0,
    description:
      "Trucker em denim rígido com lavagem feita à mão e costuras contrastantes. Peça de arquivo.",
    details: ["Denim 13oz", "Lavagem manual", "Costuras contrastantes", "Unissexo"],
  },
  {
    name: "Essentials Oversized Hoodie",
    brand: "Essentials",
    category: "Hoodies",
    price: 112000,
    colors: [CREAM, GREY, BLACK],
    sizes: APPAREL,
    assets: ["p1.jpg", "editorial-2.jpg", "p3.jpg"],
    stock: 28,
    bestSeller: true,
    description:
      "Felpo pesado em tons neutros com o logótipo emborrachado ao peito. O caimento oversized que definiu a linha.",
    details: ["Felpo pesado", "Logótipo emborrachado", "Ombro descaído", "Punhos canelados"],
  },
  {
    name: "Essentials Relaxed Sweatpants",
    brand: "Essentials",
    category: "Calças",
    price: 92000,
    compareAt: 112000,
    colors: [CREAM, GREY],
    sizes: APPAREL,
    assets: ["p3.jpg", "p1.jpg", "p6.jpg"],
    stock: 19,
    description:
      "Conjunto natural do hoodie. Perna relaxada, cintura elástica e o mesmo felpo pesado.",
    details: ["Felpo pesado", "Perna relaxada", "Cintura elástica", "Logótipo emborrachado"],
  },
  {
    name: "Gallery Dept Painted Tee",
    brand: "Gallery Dept",
    category: "T-Shirts",
    price: 148000,
    colors: [WHITE, CREAM],
    sizes: APPAREL,
    assets: ["p6.jpg", "editorial-1.jpg", "p2.jpg"],
    badge: "ULTIMAS_UNIDADES",
    stock: 3,
    description:
      "Intervencionada à mão em Los Angeles. Cada peça tem manchas e desgaste únicos — nenhuma é igual à seguinte.",
    details: ["Pintada à mão", "Algodão vintage", "Peça única", "Desgaste intencional"],
  },
  {
    name: "Nike Sportswear Cap",
    brand: "Nike",
    category: "Bonés",
    price: 32000,
    colors: [BLACK, WHITE],
    sizes: ONE_SIZE,
    assets: ["p6.jpg", "p2.jpg", "editorial-2.jpg"],
    stock: 30,
    description: "Boné de sarja com Swoosh bordado e fecho traseiro ajustável. Aba pré-curvada.",
    details: ["Sarja de algodão", "Swoosh bordado", "Fecho ajustável", "Aba pré-curvada"],
  },
  {
    name: "Corteiz Bolo Cap",
    brand: "Corteiz",
    category: "Bonés",
    price: 38000,
    colors: [BLACK, NAVY],
    sizes: ONE_SIZE,
    assets: ["p6.jpg", "editorial-2.jpg", "p2.jpg"],
    stock: 14,
    isNew: true,
    description: "Boné com o Alcatraz bordado à frente. Um dos acessórios mais procurados da marca.",
    details: ["Sarja pesada", "Alcatraz bordado", "Fecho metálico", "Interior forrado"],
  },
  {
    name: "Essentials Beanie",
    brand: "Essentials",
    category: "Acessórios",
    price: 28000,
    compareAt: 36000,
    colors: [CREAM, BLACK, GREY],
    sizes: ONE_SIZE,
    assets: ["p6.jpg", "p2.jpg", "p1.jpg"],
    stock: 22,
    description: "Gorro em malha canelada com etiqueta tecida. Tons neutros, uso diário.",
    details: ["Malha canelada", "Etiqueta tecida", "Tamanho único", "Interior macio"],
  },
];

/** Cada asset é optimizado uma vez, mesmo sendo usado por vários produtos. */
const imageCache = new Map<
  string,
  { url: string; publicId: string | null; width: number; height: number }
>();

async function ingestAsset(
  filename: string,
  folder: "produtos" | "marcas",
): Promise<{ url: string; publicId: string | null; width: number; height: number } | null> {
  const key = `${folder}:${filename}`;
  const cached = imageCache.get(key);
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
    imageCache.set(key, value);
    return value;
  } catch (error) {
    console.warn(
      `  ! ${filename}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Reparte o stock total pelas variantes (tamanho × cor), entregando o resto às
 * primeiras. A soma bate certo com o número que a interface mostra.
 */
function distributeStock(total: number, buckets: number): number[] {
  if (buckets === 0) return [];
  const base = Math.floor(total / buckets);
  const remainder = total % buckets;
  return Array.from({ length: buckets }, (_, i) => base + (i < remainder ? 1 : 0));
}

async function main(): Promise<void> {
  console.log("→ A limpar dados existentes…");
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
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.newsletterSubscriber.deleteMany();
  await prisma.user.deleteMany();
  await prisma.storeSetting.deleteMany();

  console.log("→ Categorias…");
  const categories = new Map<string, string>();
  for (const [index, name] of CATEGORIES.entries()) {
    const created = await prisma.category.create({
      data: { name, slug: slugify(name), position: index },
    });
    categories.set(name, created.id);
  }

  console.log("→ Marcas (a optimizar imagens)…");
  const brands = new Map<string, string>();
  for (const [index, brand] of BRANDS.entries()) {
    const image = brand.asset ? await ingestAsset(brand.asset, "marcas") : null;
    const created = await prisma.brand.create({
      data: {
        slug: slugify(brand.name),
        name: brand.name,
        tagline: brand.tagline,
        description: brand.description,
        imageUrl: image?.url ?? null,
        imagePublicId: image?.publicId ?? null,
        featured: brand.featured,
        position: index,
      },
    });
    brands.set(brand.name, created.id);
  }

  console.log("→ Produtos e variantes…");
  // Contador global: `buildSku` trunca o nome a 6 caracteres, por isso duas
  // peças da mesma marca ("Essentials Oversized Hoodie" e "Essentials Relaxed
  // Sweatpants") gerariam o mesmo SKU no mesmo tamanho e cor. O sufixo
  // sequencial garante unicidade em toda a loja.
  let skuCounter = 0;

  for (const product of PRODUCTS) {
    const categoryId = categories.get(product.category);
    const brandId = brands.get(product.brand);
    if (!categoryId) throw new Error(`Categoria em falta: ${product.category}`);
    if (!brandId) throw new Error(`Marca em falta: ${product.brand}`);

    const images = (
      await Promise.all(product.assets.map((asset) => ingestAsset(asset, "produtos")))
    ).filter((image): image is NonNullable<typeof image> => image !== null);

    const combos = product.sizes.flatMap((size) =>
      product.colors.map((color) => ({ size, color })),
    );
    const stockPerVariant = distributeStock(product.stock, combos.length);

    // O nome guardado NÃO repete a marca: a interface mostra os dois campos
    // lado a lado, e "Nike" + "Nike Tech Fleece Hoodie" leria como
    // "Nike Nike Tech Fleece Hoodie". No seed escrevemos o nome completo por
    // ser mais legível, e retiramos aqui o prefixo da marca.
    const displayName = product.name.startsWith(product.brand)
      ? product.name.slice(product.brand.length).trim()
      : product.name;

    // O slug mantém a marca: dá URLs inequívocos e diz de imediato de quem é a peça.
    const slug = slugify(`${product.brand} ${displayName}`);

    await prisma.product.create({
      data: {
        slug,
        name: displayName,
        description: product.description,
        details: product.details,
        price: product.price,
        compareAt: product.compareAt ?? null,
        categoryId,
        brandId,
        badge: product.badge ?? null,
        isNew: product.isNew ?? false,
        bestSeller: product.bestSeller ?? false,
        metaTitle: `${product.brand} ${displayName} — CHICOPLUG`,
        metaDescription: product.description.slice(0, 155),
        images: {
          create: images.map((image, index) => ({
            url: image.url,
            publicId: image.publicId,
            alt: `${product.brand} ${displayName} — vista ${index + 1}`,
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
            sku: `${buildSku(`${product.brand} ${displayName}`, combo.size, combo.color.name)}-${String(skuCounter + index).padStart(4, "0")}`,
            stock: stockPerVariant[index] ?? 0,
            lowStockThreshold: 6,
          })),
        },
      },
    });

    skuCounter += combos.length;
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

  await prisma.user.create({
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
        ],
      },
    },
  });

  console.log("→ Cupões…");
  await prisma.coupon.createMany({
    data: [
      { code: "BEMVINDO", type: "FIXED", value: 5000, minSubtotal: 30000, maxRedemptions: 200, active: true },
      { code: "STREET10", type: "PERCENT", value: 10, minSubtotal: 80000, active: true },
    ],
  });

  const promos = PRODUCTS.filter((p) => p.compareAt).length;
  console.log("\n✔ Seed concluído.");
  console.log(`  ${BRANDS.length} marcas · ${CATEGORIES.length} categorias · ${PRODUCTS.length} produtos (${promos} em promoção)`);
  console.log(`  Admin:   ${adminEmail} / ${adminPassword}`);
  console.log(`  Cliente: cliente@chicoplug.ao / Cliente!2026`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed falhou:", error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
