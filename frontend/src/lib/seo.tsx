import type { Product } from "./catalog";

/**
 * Dados estruturados Schema.org.
 *
 * São o que permite ao Google mostrar preço, disponibilidade e avaliação
 * directamente no resultado de pesquisa (rich snippets). Sem isto a loja
 * aparece como um link de texto entre milhões.
 */

export const SITE_URL =
  (import.meta.env["VITE_PUBLIC_SITE_URL"] as string | undefined) ?? "https://chicoplug.ao";

/** Converte URLs relativas da API em absolutas, exigidas pelo Schema.org. */
export function absoluteUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${SITE_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "CHICOPLUG",
    url: SITE_URL,
    logo: absoluteUrl("/favicon.ico"),
    description:
      "Streetwear premium de edição limitada. Drops, essenciais e coleções feitas em Luanda.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Luanda",
      addressCountry: "AO",
    },
    sameAs: ["https://instagram.com/chicoplug"],
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "CHICOPLUG",
    url: SITE_URL,
    // Declara a pesquisa interna para o Google a poder expor no resultado.
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/shop?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function productSchema(product: Product) {
  const inStock = product.stock > 0;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.variants[0]?.sku ?? product.slug,
    image: product.images.map(absoluteUrl),
    brand: { "@type": "Brand", name: "CHICOPLUG" },
    category: product.category,
    color: product.colors.map((c) => c.name).join(", "),
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/produto/${product.slug}`,
      // AOA é o código ISO 4217 do Kwanza.
      priceCurrency: "AOA",
      price: product.price,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "CHICOPLUG" },
    },
  };
}

export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

export function collectionSchema(input: {
  name: string;
  description: string;
  slug: string;
  products: Product[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url: `${SITE_URL}/colecoes/${input.slug}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: input.products.length,
      itemListElement: input.products.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}/produto/${product.slug}`,
        name: product.name,
      })),
    },
  };
}

/**
 * Injecta um bloco JSON-LD.
 *
 * `dangerouslySetInnerHTML` é seguro aqui e, na prática, obrigatório: o React
 * escaparia as aspas do JSON dentro de `<script>` e os motores de busca leriam
 * lixo. O conteúdo vem de `JSON.stringify` sobre objectos que construímos, nunca
 * de HTML fornecido pelo utilizador. Ainda assim escapamos `<` para que uma
 * descrição de produto não possa fechar a tag `</script>` e injectar código.
 */
export function JsonLd({ schema }: { schema: Record<string, unknown> }) {
  const json = JSON.stringify(schema).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
