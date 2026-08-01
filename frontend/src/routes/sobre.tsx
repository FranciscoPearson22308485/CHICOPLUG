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
          "A CHICOPLUG é a boutique de streetwear premium de Luanda: as melhores marcas internacionais, seleccionadas peça a peça, com origem garantida.",
      },
      { property: "og:title", content: "Sobre — CHICOPLUG" },
      { property: "og:description", content: "Selecção rigorosa, origem garantida. Em Luanda." },
    ],
  }),
  component: Sobre,
});

const PILLARS = [
  {
    n: "01",
    t: "Produto original",
    d: "Trabalhamos apenas com fornecedores verificados. Cada peça chega com a garantia da marca.",
  },
  {
    n: "02",
    t: "Selecção criteriosa",
    d: "Não vendemos tudo. Escolhemos o que vale a pena vestir e ignoramos o resto.",
  },
  {
    n: "03",
    t: "Entrega em todo o país",
    d: "De Luanda a Cabinda. Pagamento por Multicaixa Express e acompanhamento da encomenda.",
  },
];

function Sobre() {
  return (
    <div className="pb-28">
      <section className="shell pt-16 md:pt-24">
        <Reveal>
          <p className="eyebrow">A loja</p>
          <h1 className="mt-6 max-w-[18ch] text-6xl sm:text-7xl xl:text-[7rem]">
            As marcas certas, num só lugar
          </h1>
        </Reveal>
      </section>

      <Reveal className="shell mt-20">
        <img
          src={IMAGES.editorial1}
          alt="Loja e comunidade CHICOPLUG em Luanda"
          loading="lazy"
          className="aspect-[16/9] w-full object-cover"
        />
      </Reveal>

      <section className="shell grid gap-16 py-24 md:grid-cols-2 md:py-32">
        <Reveal>
          <h2 className="text-4xl sm:text-5xl">Começou por necessidade</h2>
        </Reveal>
        <Reveal delay={120} className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <p>
            Em Luanda, quem queria uma peça da Nike, da Corteiz ou da Represent tinha duas
            hipóteses: pagar portes internacionais e esperar semanas, ou arriscar numa réplica. A
            CHICOPLUG existe para acabar com essa escolha.
          </p>
          <p>
            Curamos o catálogo peça a peça. Trabalhamos com fornecedores verificados e só colocamos
            à venda o que confirmamos ser original — do sneaker à t-shirt.
          </p>
          <p>
            Não fabricamos roupa. O nosso trabalho é escolher bem, garantir a origem e pôr a peça à
            tua porta em todo o Angola.
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
          <h2 className="text-4xl sm:text-5xl">Vê o que temos</h2>
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            Novas peças todas as semanas. As mais procuradas esgotam depressa.
          </p>
          <Link
            to="/shop"
            className="mt-10 inline-block bg-foreground px-10 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-brand hover:text-brand-foreground"
          >
            Comprar Agora
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
