import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import type { Brand, Product } from "@/lib/catalog";
import { catalogApi } from "@/lib/queries";
import { JsonLd, breadcrumbSchema, brandSchema } from "@/lib/seo";
import { ProductCard } from "@/components/site/ProductCard";
import { Reveal } from "@/components/site/Reveal";
import { EmptyState } from "@/components/site/Primitives";

export const Route = createFileRoute("/marcas/$slug")({
  loader: async ({ params }): Promise<{ brand: Brand; products: Product[] }> => {
    try {
      return await catalogApi.brand(params.slug);
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Marca indisponível — CHICOPLUG" }, { name: "robots", content: "noindex" }],
      };
    }
    const { brand, products } = loaderData;
    const description =
      brand.description ||
      `${products.length} peças ${brand.name} disponíveis na CHICOPLUG, com entrega em todo o Angola.`;

    return {
      meta: [
        { title: `${brand.name} — CHICOPLUG` },
        { name: "description", content: description },
        { property: "og:title", content: `${brand.name} — CHICOPLUG` },
        { property: "og:description", content: description },
        ...(brand.image ? [{ property: "og:image", content: brand.image }] : []),
      ],
    };
  },
  component: MarcaDetalhe,
});

function MarcaDetalhe() {
  const { brand, products } = Route.useLoaderData() as { brand: Brand; products: Product[] };

  return (
    <div className="pb-28">
      <JsonLd schema={brandSchema({ ...brand, products })} />
      <JsonLd
        schema={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Marcas", url: "/marcas" },
          { name: brand.name, url: `/marcas/${brand.slug}` },
        ])}
      />

      <section className="relative h-[70svh] min-h-[420px] overflow-hidden bg-ink">
        {brand.image && (
          <img
            src={brand.image}
            alt={brand.name}
            className="absolute inset-0 size-full object-cover opacity-85"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 to-transparent" />
        <div className="shell relative flex h-full flex-col justify-end pb-14">
          <Reveal>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/70">
              {brand.tagline}
            </p>
            <h1 className="display-xl mt-6 text-[13vw] text-white lg:text-[7vw]">{brand.name}</h1>
          </Reveal>
        </div>
      </section>

      <div className="shell">
        <Reveal className="mx-auto max-w-2xl py-20 text-center md:py-28">
          <p className="text-base leading-relaxed text-muted-foreground">{brand.description}</p>
        </Reveal>

        {products.length === 0 ? (
          <EmptyState
            title="Sem peças disponíveis"
            description="Esta marca está esgotada de momento. Inscreve-te na newsletter para saberes quando repuser."
            action={
              <Link
                to="/shop"
                className="bg-foreground px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-background"
              >
                Ver shop
              </Link>
            }
          />
        ) : (
          <>
            <div className="mb-12 flex items-center justify-between border-b border-border pb-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {products.length} {products.length === 1 ? "peça" : "peças"}
              </p>
              <Link
                to="/shop"
                search={{ marca: brand.slug } as never}
                className="link-underline text-[11px] font-semibold uppercase tracking-[0.2em]"
              >
                Filtrar no shop
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-14 md:grid-cols-3 md:gap-x-8">
              {products.map((p, i) => (
                <Reveal key={p.id} delay={i * 70}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
