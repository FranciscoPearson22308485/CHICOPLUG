import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Instagram } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { IMAGES, formatKz, type Brand, type Category, type Product } from "@/lib/catalog";
import { catalogApi } from "@/lib/queries";
import { ProductCard } from "@/components/site/ProductCard";
import { Reveal } from "@/components/site/Reveal";
import { NewsletterForm } from "@/components/site/NewsletterForm";
import { Marquee, SectionHeading, TextLink } from "@/components/site/Primitives";

type HomeData = {
  newArrivals: Product[];
  brands: Brand[];
  bestSellers: Product[];
  categories: Category[];
  promotions: Product[];
};

const EMPTY_HOME: HomeData = {
  newArrivals: [],
  brands: [],
  bestSellers: [],
  categories: [],
  promotions: [],
};

export const Route = createFileRoute("/")({
  // Carregado no servidor: a homepage chega ao browser já com o catálogo
  // renderizado, que é o que os motores de busca indexam.
  loader: async (): Promise<HomeData> => {
    try {
      return await catalogApi.home();
    } catch (error) {
      // Uma API em baixo não deve deixar a montra em branco: o resto da página
      // continua a ter valor.
      console.error("Falha ao carregar a homepage", error);
      return EMPTY_HOME;
    }
  },
  head: () => ({
    meta: [
      { title: "CHICOPLUG — Streetwear Premium | Nike, Jordan, Corteiz e mais" },
      {
        name: "description",
        content:
          "As melhores marcas de streetwear num só lugar. Nike, Jordan, Adidas, Corteiz, Represent e Essentials, com entrega em todo o Angola.",
      },
      { property: "og:title", content: "CHICOPLUG — Streetwear Premium" },
      {
        property: "og:description",
        content: "As melhores marcas de streetwear num só lugar.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const data = Route.useLoaderData() as HomeData;

  return (
    <div>
      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="relative h-[92svh] min-h-[560px] w-full overflow-hidden bg-ink">
        <img
          src={hero}
          alt="Editorial de streetwear CHICOPLUG"
          width={1600}
          height={1904}
          className="absolute inset-0 size-full object-cover object-[50%_35%] opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-ink/30" />
        <div className="shell relative flex h-full flex-col justify-end pb-16 md:pb-24">
          <Reveal>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/70">
              Streetwear premium — Luanda
            </p>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="display-xl mt-6 max-w-[16ch] text-[13vw] text-white sm:text-[10vw] lg:text-[7.5vw]">
              As melhores
              <br />
              marcas num
              <br />
              só lugar
            </h1>
          </Reveal>
          <Reveal delay={240} className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/shop"
              /* O hero assenta sobre uma fotografia escura nos dois temas, por
                 isso o botão principal é branco fixo: se seguisse o tema,
                 tornar-se-ia escuro sobre escuro em modo noturno. */
              className="group inline-flex items-center gap-4 bg-white px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-ink transition-colors hover:bg-brand hover:text-brand-foreground"
            >
              Comprar Agora
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              to="/marcas"
              className="inline-flex items-center gap-4 border border-white/40 px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-white transition-colors hover:border-white hover:bg-white hover:text-ink"
            >
              Ver Marcas
            </Link>
          </Reveal>
        </div>
      </section>

      <Marquee
        items={[
          "Peças originais",
          "Entregas em todo Angola",
          "Multicaixa Express",
          "As marcas mais procuradas",
        ]}
      />

      {/* ── NOVIDADES ──────────────────────────────────────────────────── */}
      <section className="shell py-24 md:py-32">
        <Reveal>
          <SectionHeading
            eyebrow="Acabado de chegar"
            title="Novidades"
            action={<TextLink to="/shop">Ver tudo</TextLink>}
          />
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-8 xl:grid-cols-4">
          {data.newArrivals.map((p, i) => (
            <Reveal key={p.id} delay={i * 90}>
              <ProductCard product={p} priority={i < 2} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── MARCAS POPULARES ───────────────────────────────────────────── */}
      <section className="bg-surface py-24 md:py-32">
        <div className="shell">
          <Reveal>
            <SectionHeading
              eyebrow="Selecção da casa"
              title="Marcas Populares"
              action={<TextLink to="/marcas">Todas as marcas</TextLink>}
            />
          </Reveal>
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {data.brands.map((brand, i) => (
              <Reveal key={brand.id} delay={i * 60}>
                <Link
                  to="/marcas/$slug"
                  params={{ slug: brand.slug }}
                  className="group flex h-full flex-col justify-between border border-border bg-background p-6 transition-colors duration-500 hover:border-foreground md:p-8"
                >
                  <div className="min-w-0">
                    {/* Sem logótipos de terceiros, a marca é apresentada em
                        tipografia — mais coerente com o desenho do que um
                        mosaico de logótipos de proveniências diferentes. */}
                    <p className="font-display text-2xl uppercase leading-none tracking-brand md:text-3xl">
                      {brand.name}
                    </p>
                    {brand.tagline && (
                      <p className="mt-3 line-clamp-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        {brand.tagline}
                      </p>
                    )}
                  </div>
                  <div className="mt-8 flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {brand.productCount} {brand.productCount === 1 ? "peça" : "peças"}
                    </span>
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── MAIS VENDIDOS ──────────────────────────────────────────────── */}
      <section className="shell py-24 md:py-32">
        <Reveal>
          <SectionHeading
            eyebrow="Os mais procurados"
            title="Mais Vendidos"
            action={<TextLink to="/shop">Ver tudo</TextLink>}
          />
        </Reveal>
        <div className="no-scrollbar mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto md:grid md:grid-cols-4 md:gap-8 md:overflow-visible">
          {data.bestSellers.slice(0, 4).map((p, i) => (
            <Reveal key={p.id} delay={i * 90} className="min-w-[68%] snap-start md:min-w-0">
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CATEGORIAS ─────────────────────────────────────────────────── */}
      <section className="shell pb-24 md:pb-32">
        <Reveal>
          <SectionHeading
            eyebrow="Procura por tipo"
            title="Categorias"
            action={<TextLink to="/shop">Shop</TextLink>}
          />
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
          {data.categories.map((category, i) => (
            <Reveal key={category.id} delay={i * 70}>
              <Link
                to="/shop"
                search={{ categoria: category.slug } as never}
                className="group relative block overflow-hidden bg-surface"
              >
                {category.image ? (
                  <img
                    src={category.image}
                    alt={category.name}
                    loading="lazy"
                    className="aspect-[3/4] w-full object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
                  />
                ) : (
                  <div className="aspect-[3/4] w-full bg-surface" />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-5 pt-16">
                  <h3 className="text-lg text-white">{category.name}</h3>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/70">
                    {category.productCount} {category.productCount === 1 ? "peça" : "peças"}
                  </p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── PROMOÇÕES ──────────────────────────────────────────────────── */}
      {data.promotions.length > 0 && (
        <section className="border-y border-border bg-surface py-24 md:py-32">
          <div className="shell">
            <Reveal>
              <SectionHeading
                eyebrow="Preços reduzidos"
                title="Promoções"
                action={<TextLink to="/shop">Ver todas</TextLink>}
              />
            </Reveal>
            <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-4 md:gap-x-8">
              {data.promotions.slice(0, 4).map((p, i) => (
                <Reveal key={p.id} delay={i * 80}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── SOBRE A LOJA ───────────────────────────────────────────────── */}
      <section className="border-b border-border bg-ink text-ink-foreground">
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-ink-foreground/50">
              A loja
            </p>
            <h2 className="mt-6 text-4xl sm:text-5xl">
              Selecção rigorosa,
              <br />
              origem garantida
            </h2>
            <p className="mt-8 max-w-md text-sm leading-relaxed text-ink-foreground/60">
              Escolhemos peça a peça o que vale a pena vestir. Trabalhamos apenas com produto
              original, de marcas que definem o streetwear — e entregamos em todo o Angola.
            </p>
            <div className="mt-10">
              <Link
                to="/sobre"
                className="link-underline text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-foreground"
              >
                Sobre a CHICOPLUG
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── INSTAGRAM ──────────────────────────────────────────────────── */}
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
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="group block overflow-hidden bg-surface"
              >
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

      {/* ── NEWSLETTER ─────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-surface">
        <div className="shell grid gap-10 py-20 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:py-28">
          <Reveal>
            <p className="eyebrow">Lista de espera</p>
            <h2 className="mt-6 text-4xl sm:text-5xl">
              Sabe primeiro
              <br />o que chega
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
              As peças mais procuradas esgotam em horas. Avisamos-te por email antes de entrarem na
              loja.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <NewsletterForm source="home" />
          </Reveal>
        </div>
      </section>
    </div>
  );
}
