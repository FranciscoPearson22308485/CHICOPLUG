import { createFileRoute, Link } from "@tanstack/react-router";
import { COLLECTIONS } from "@/lib/catalog";
import { Reveal } from "@/components/site/Reveal";

export const Route = createFileRoute("/colecoes/")({
  head: () => ({
    meta: [
      { title: "Coleções — CHICOPLUG" },
      {
        name: "description",
        content: "O arquivo CHICOPLUG: drops limitados e a linha permanente de essenciais.",
      },
      { property: "og:title", content: "Coleções — CHICOPLUG" },
      { property: "og:description", content: "Drops limitados e essenciais permanentes." },
    ],
  }),
  component: Colecoes,
});

function Colecoes() {
  return (
    <div className="pb-28 pt-16 md:pt-24">
      <div className="shell">
        <Reveal>
          <p className="eyebrow">Arquivo</p>
          <h1 className="mt-5 text-6xl sm:text-7xl xl:text-8xl">Coleções</h1>
          <p className="mt-8 max-w-md text-sm leading-relaxed text-muted-foreground">
            Cada coleção é produzida uma vez. O que resta do arquivo fica aqui.
          </p>
        </Reveal>
      </div>

      <div className="mt-20 space-y-20 md:space-y-32">
        {COLLECTIONS.map((c, i) => (
          <Reveal key={c.slug} className="shell">
            <Link
              to="/colecoes/$slug"
              params={{ slug: c.slug }}
              className={`group grid items-center gap-8 md:grid-cols-2 md:gap-16 ${
                i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
              }`}
            >
              <div className="overflow-hidden bg-surface">
                <img
                  src={c.image}
                  alt={c.name}
                  loading="lazy"
                  className="aspect-[4/5] w-full object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
                />
              </div>
              <div>
                <p className="eyebrow">{c.season}</p>
                <h2 className="mt-6 text-4xl sm:text-5xl xl:text-6xl">{c.name}</h2>
                <p className="mt-8 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {c.description}
                </p>
                <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.2em]">
                  {c.pieces} peças — Ver coleção
                </p>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}