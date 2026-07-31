import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { COLLECTIONS, PRODUCTS, type Collection } from "@/lib/catalog";
import { ProductCard } from "@/components/site/ProductCard";
import { Reveal } from "@/components/site/Reveal";
import { EmptyState } from "@/components/site/Primitives";

export const Route = createFileRoute("/colecoes/$slug")({
  loader: ({ params }): { collection: Collection } => {
    const collection = COLLECTIONS.find((c) => c.slug === params.slug);
    if (!collection) throw notFound();
    return { collection };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Coleção indisponível — CHICOPLUG" }, { name: "robots", content: "noindex" }] };
    }
    const { collection } = loaderData;
    return {
      meta: [
        { title: `${collection.name} — CHICOPLUG` },
        { name: "description", content: collection.description },
        { property: "og:title", content: `${collection.name} — CHICOPLUG` },
        { property: "og:description", content: collection.description },
      ],
    };
  },
  component: ColecaoDetalhe,
});

function ColecaoDetalhe() {
  const { collection } = Route.useLoaderData() as { collection: Collection };
  const items = PRODUCTS.filter((p) => p.collection === collection.slug);

  return (
    <div className="pb-28">
      <section className="relative h-[70svh] min-h-[420px] overflow-hidden bg-foreground">
        <img
          src={collection.image}
          alt={collection.name}
          className="absolute inset-0 size-full object-cover opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 to-transparent" />
        <div className="shell relative flex h-full flex-col justify-end pb-14">
          <Reveal>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-background/70">
              {collection.season}
            </p>
            <h1 className="display-xl mt-6 text-[13vw] text-background lg:text-[7vw]">
              {collection.name}
            </h1>
          </Reveal>
        </div>
      </section>

      <div className="shell">
        <Reveal className="mx-auto max-w-2xl py-20 text-center md:py-28">
          <p className="text-base leading-relaxed text-muted-foreground">{collection.description}</p>
        </Reveal>

        {items.length === 0 ? (
          <EmptyState
            title="Coleção esgotada"
            description="Todas as peças desta coleção foram vendidas. Entra na lista para o próximo drop."
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
          <div className="grid grid-cols-2 gap-x-4 gap-y-14 md:grid-cols-3 md:gap-x-8">
            {items.map((p, i) => (
              <Reveal key={p.id} delay={i * 70}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}