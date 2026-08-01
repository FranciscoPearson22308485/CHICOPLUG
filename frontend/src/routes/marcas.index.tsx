import { createFileRoute, Link } from "@tanstack/react-router";
import type { Brand } from "@/lib/catalog";
import { catalogApi } from "@/lib/queries";
import { Reveal } from "@/components/site/Reveal";
import { EmptyState } from "@/components/site/Primitives";

export const Route = createFileRoute("/marcas/")({
  loader: async (): Promise<Brand[]> => {
    try {
      const { brands } = await catalogApi.brands();
      return brands;
    } catch (error) {
      console.error("Falha ao carregar marcas", error);
      return [];
    }
  },
  head: () => ({
    meta: [
      { title: "Marcas — CHICOPLUG" },
      {
        name: "description",
        content:
          "Todas as marcas disponíveis na CHICOPLUG: Nike, Jordan, Adidas, Corteiz, Represent, Hellstar, Denim Tears, Essentials e Gallery Dept.",
      },
      { property: "og:title", content: "Marcas — CHICOPLUG" },
      { property: "og:description", content: "As marcas que definem o streetwear." },
    ],
  }),
  component: Marcas,
});

function Marcas() {
  const brands = Route.useLoaderData() as Brand[];

  return (
    <div className="pb-28 pt-16 md:pt-24">
      <div className="shell">
        <Reveal>
          <p className="eyebrow">Selecção</p>
          <h1 className="mt-5 text-6xl sm:text-7xl xl:text-8xl">Marcas</h1>
          <p className="mt-8 max-w-md text-sm leading-relaxed text-muted-foreground">
            Trabalhamos apenas com produto original. Cada marca é escolhida pelo que traz ao
            guarda-roupa, não pelo nome.
          </p>
        </Reveal>
      </div>

      {brands.length === 0 ? (
        <div className="shell mt-20">
          <EmptyState
            title="Sem marcas disponíveis"
            description="Ainda não há marcas publicadas. Volta em breve."
            action={
              <Link
                to="/shop"
                className="bg-foreground px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-background"
              >
                Ver shop
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-20 space-y-20 md:space-y-32">
          {brands.map((brand, i) => (
            <Reveal key={brand.slug} className="shell">
              <Link
                to="/marcas/$slug"
                params={{ slug: brand.slug }}
                className={`group grid items-center gap-8 md:grid-cols-2 md:gap-16 ${
                  i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div className="overflow-hidden bg-surface">
                  {brand.image ? (
                    <img
                      src={brand.image}
                      alt={brand.name}
                      loading="lazy"
                      className="aspect-[4/5] w-full object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid aspect-[4/5] w-full place-items-center bg-surface">
                      <span className="font-display text-4xl uppercase tracking-brand text-muted-foreground">
                        {brand.name}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="eyebrow">{brand.tagline}</p>
                  <h2 className="mt-6 text-4xl sm:text-5xl xl:text-6xl">{brand.name}</h2>
                  <p className="mt-8 max-w-md text-sm leading-relaxed text-muted-foreground">
                    {brand.description}
                  </p>
                  <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.2em]">
                    {brand.productCount} {brand.productCount === 1 ? "peça" : "peças"} — Ver marca
                  </p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
