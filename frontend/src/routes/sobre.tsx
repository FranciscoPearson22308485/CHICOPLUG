import { createFileRoute, Link } from "@tanstack/react-router";
import { IMAGES } from "@/lib/catalog";
import { Reveal } from "@/components/site/Reveal";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — CHICOPLUG" },
      {
        name: "description",
        content:
          "A CHICOPLUG nasceu em Luanda: roupa pesada, cortes certos e produções limitadas de streetwear premium.",
      },
      { property: "og:title", content: "Sobre — CHICOPLUG" },
      { property: "og:description", content: "Cultura urbana, padrão premium. Feito em Luanda." },
    ],
  }),
  component: Sobre,
});

const PILLARS = [
  { n: "01", t: "Produção limitada", d: "Cada peça é feita uma vez. Sem restocks, sem excesso." },
  { n: "02", t: "Matéria-prima honesta", d: "Gramagens pesadas, algodões densos, acabamentos revistos à mão." },
  { n: "03", t: "Cultura primeiro", d: "Desenhamos com a rua, não para a rua. A comunidade valida o drop." },
];

function Sobre() {
  return (
    <div className="pb-28">
      <section className="shell pt-16 md:pt-24">
        <Reveal>
          <p className="eyebrow">A marca</p>
          <h1 className="mt-6 max-w-[18ch] text-6xl sm:text-7xl xl:text-[7rem]">
            Cultura urbana, padrão premium
          </h1>
        </Reveal>
      </section>

      <Reveal className="shell mt-20">
        <img
          src={IMAGES.editorial1}
          alt="Equipa e comunidade CHICOPLUG na rua"
          loading="lazy"
          className="aspect-[16/9] w-full object-cover"
        />
      </Reveal>

      <section className="shell grid gap-16 py-24 md:grid-cols-2 md:py-32">
        <Reveal>
          <h2 className="text-4xl sm:text-5xl">Começou num bairro</h2>
        </Reveal>
        <Reveal delay={120} className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <p>
            A CHICOPLUG começou com vinte hoodies e uma lista de espera. Sem showroom, sem
            intermediários — só peças pesadas e pessoas que as queriam vestir todos os dias.
          </p>
          <p>
            Hoje trabalhamos por volumes: cada volume é uma coleção fechada, com número de peças
            definido antes da produção. O que sobra volta ao arquivo; o que esgota fica na memória.
          </p>
          <p>
            Continuamos a desenhar em Luanda, a produzir em pequenas séries e a enviar para todo o
            país.
          </p>
        </Reveal>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="shell grid gap-12 py-24 md:grid-cols-3 md:py-28">
          {PILLARS.map((p, i) => (
            <Reveal key={p.n} delay={i * 120}>
              <p className="font-display text-5xl tracking-brand text-brand">{p.n}</p>
              <h3 className="mt-6 text-2xl">{p.t}</h3>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{p.d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="shell py-24 text-center md:py-32">
        <Reveal className="mx-auto max-w-2xl">
          <h2 className="text-4xl sm:text-5xl">Próximo drop em breve</h2>
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            Segue a lista para acesso antecipado. As peças esgotam em horas.
          </p>
          <Link
            to="/shop"
            className="mt-10 inline-block bg-foreground px-10 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-brand hover:text-brand-foreground"
          >
            Shop Now
          </Link>
        </Reveal>
      </section>
    </div>
  );
}