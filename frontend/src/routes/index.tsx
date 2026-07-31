import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Instagram } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { IMAGES, type Collection, type Product } from "@/lib/catalog";
import { catalogApi } from "@/lib/queries";
import { ProductCard } from "@/components/site/ProductCard";
import { Reveal } from "@/components/site/Reveal";
import { Marquee, SectionHeading, TextLink } from "@/components/site/Primitives";

type HomeData = {
  featured: Product[];
  drops: Product[];
  bestSellers: Product[];
  collections: Collection[];
};

const EMPTY_HOME: HomeData = { featured: [], drops: [], bestSellers: [], collections: [] };

export const Route = createFileRoute("/")({
  // Carregado no servidor: a homepage chega ao browser já com o catálogo
  // renderizado, que é o que os motores de busca indexam.
  loader: async (): Promise<HomeData> => {
    try {
      return await catalogApi.home();
    } catch (error) {
      // Uma API em baixo não deve deixar a montra em branco: o resto da
      // página (hero, marca, Instagram) continua a ter valor.
      console.error("Falha ao carregar a homepage", error);
      return EMPTY_HOME;
    }
  },
  head: () => ({
    meta: [
      { title: "CHICOPLUG — Streetwear Premium de Edição Limitada" },
      {
        name: "description",
        content:
          "Drops limitados, essenciais pesados e coleções feitas para durar. CHICOPLUG, streetwear premium de Luanda para o mundo.",
      },
      { property: "og:title", content: "CHICOPLUG — Streetwear Premium" },
      {
        property: "og:description",
        content: "Drops limitados, essenciais pesados. Streetwear premium.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const data = Route.useLoaderData() as HomeData;
  const novidades = data.featured;
  const drops = data.drops;
  const best = data.bestSellers;
  const COLLECTIONS = data.collections;

  return (
    <div>
      {/* HERO */}
      <section className="relative h-[92svh] min-h-[560px] w-full overflow-hidden bg-foreground">
        <img
          src={hero}
          alt="Campanha editorial CHICOPLUG"
          width={1600}
          height={1904}
          className="absolute inset-0 size-full object-cover object-[50%_35%] opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/10 to-foreground/30" />
        <div className="shell relative flex h-full flex-col justify-end pb-16 md:pb-24">
          <Reveal>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-background/70">
              Drop 02 / 2026 — Night Shift
            </p>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="display-xl mt-6 max-w-[16ch] text-[16vw] text-background sm:text-[11vw] lg:text-[8.5vw]">
              Feito para
              <br />
              a rua
            </h1>
          </Reveal>
          <Reveal delay={240} className="mt-10 flex items-center gap-6">
            <Link
              to="/shop"
              className="group inline-flex items-center gap-4 bg-background px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-foreground transition-colors hover:bg-brand"
            >
              Shop Now
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>
      </section>

      <Marquee
        items={["Edição limitada", "Entregas em todo Angola", "Multicaixa Express", "Sem restock"]}
      />

      {/* NOVIDADES */}
      <section className="shell py-24 md:py-32">
        <Reveal>
          <SectionHeading
            eyebrow="Acabado de chegar"
            title="Novidades"
            action={<TextLink to="/shop">Ver tudo</TextLink>}
          />
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-8 xl:grid-cols-4">
          {novidades.map((p, i) => (
            <Reveal key={p.id} delay={i * 90}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* DROPS */}
      <section className="bg-surface py-24 md:py-32">
        <div className="shell">
          <Reveal className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <p className="eyebrow">Drop ativo</p>
              <h2 className="mt-6 text-5xl sm:text-6xl xl:text-7xl">
                Night
                <br />
                Shift
              </h2>
              <p className="mt-8 max-w-md text-sm leading-relaxed text-muted-foreground">
                Oito peças. Uma cor. Produzidas uma única vez — quando esgota, não volta.
              </p>
              <div className="mt-10">
                <TextLink to="/colecoes">Explorar o drop</TextLink>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 md:gap-8">
              {drops.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* BEST SELLERS */}
      <section className="shell py-24 md:py-32">
        <Reveal>
          <SectionHeading
            eyebrow="Os mais pedidos"
            title="Best Sellers"
            action={<TextLink to="/shop">Ver tudo</TextLink>}
          />
        </Reveal>
        <div className="no-scrollbar mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto md:grid md:grid-cols-3 md:gap-8 md:overflow-visible">
          {best.map((p, i) => (
            <Reveal key={p.id} delay={i * 90} className="min-w-[68%] snap-start md:min-w-0">
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* COLEÇÕES */}
      <section className="shell pb-24 md:pb-32">
        <Reveal>
          <SectionHeading eyebrow="Arquivo" title="Coleções" action={<TextLink to="/colecoes">Índice</TextLink>} />
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-3 md:gap-8">
          {COLLECTIONS.map((c, i) => (
            <Reveal key={c.slug} delay={i * 100}>
              <Link
                to="/colecoes/$slug"
                params={{ slug: c.slug }}
                className="group block overflow-hidden bg-surface"
              >
                <img
                  src={c.image}
                  alt={c.name}
                  loading="lazy"
                  className="aspect-[3/4] w-full object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
                />
                <div className="flex items-end justify-between gap-4 bg-background px-1 pt-5">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg">{c.name}</h3>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {c.season}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{c.pieces} peças</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SOBRE A MARCA */}
      <section className="border-y border-border bg-foreground text-background">
        <div className="shell grid gap-16 py-24 md:grid-cols-2 md:py-32">
          <Reveal>
            <img
              src={IMAGES.editorial1}
              alt="Editorial de rua CHICOPLUG"
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
          </Reveal>
          <Reveal delay={140} className="flex flex-col justify-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-background/50">
              A marca
            </p>
            <h2 className="mt-6 text-4xl sm:text-5xl">
              Cultura urbana,
              <br />
              padrão premium
            </h2>
            <p className="mt-8 max-w-md text-sm leading-relaxed text-background/60">
              Nascemos em Luanda com uma ideia simples: roupa pesada, cortes certos, quantidades
              pequenas. Cada peça é desenhada para viver anos e não uma estação.
            </p>
            <div className="mt-10">
              <Link
                to="/sobre"
                className="link-underline text-[11px] font-semibold uppercase tracking-[0.2em] text-background"
              >
                Sobre a CHICOPLUG
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* INSTAGRAM */}
      <section className="shell py-24 md:py-32">
        <Reveal>
          <SectionHeading
            eyebrow="@chicoplug"
            title="Nas ruas"
            action={
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="link-underline inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
              >
                <Instagram className="size-4" /> Seguir
              </a>
            }
          />
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
          {[IMAGES.editorial2, IMAGES.p1, IMAGES.editorial1, IMAGES.p5].map((img, i) => (
            <Reveal key={i} delay={i * 80}>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="group block overflow-hidden bg-surface">
                <img
                  src={img}
                  alt="Publicação Instagram CHICOPLUG"
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
                />
              </a>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
