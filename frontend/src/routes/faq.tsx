import { createFileRoute } from "@tanstack/react-router";
import { Reveal } from "@/components/site/Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — CHICOPLUG" },
      {
        name: "description",
        content: "Perguntas frequentes sobre drops, tamanhos, envios, pagamentos e trocas CHICOPLUG.",
      },
      { property: "og:title", content: "FAQ — CHICOPLUG" },
      { property: "og:description", content: "Drops, tamanhos, envios, pagamentos e trocas." },
    ],
  }),
  component: Faq,
});

const GROUPS = [
  {
    title: "Drops",
    items: [
      ["Com que frequência lançam drops?", "Lançamos entre quatro e seis drops por ano, sempre anunciados na lista de email e no Instagram."],
      ["Há restock das peças esgotadas?", "Não. Cada coleção é produzida uma única vez."],
    ],
  },
  {
    title: "Tamanhos",
    items: [
      ["Os cortes são oversized?", "Sim, a maioria das peças tem corte oversized. Consulta a tabela de tamanhos em cada produto."],
      ["E se errar o tamanho?", "Podes trocar em 7 dias, desde que a peça esteja intacta e com etiqueta."],
    ],
  },
  {
    title: "Envios e pagamentos",
    items: [
      ["Enviam para todas as províncias?", "Sim. Luanda em 24–72h; restantes províncias entre 3 e 7 dias úteis."],
      ["Que métodos de pagamento aceitam?", "Multicaixa Express. Outros métodos serão adicionados em breve."],
    ],
  },
];

function Faq() {
  return (
    <div className="shell pb-28 pt-16 md:pt-24">
      <Reveal>
        <p className="eyebrow">Ajuda</p>
        <h1 className="mt-5 text-6xl sm:text-7xl">FAQ</h1>
      </Reveal>

      <div className="mt-20 grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-24">
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Não encontraste o que procuravas? Escreve-nos e respondemos em 24h.
          </p>
        </Reveal>
        <div className="space-y-16">
          {GROUPS.map((g, gi) => (
            <Reveal key={g.title} delay={gi * 80}>
              <h2 className="mb-4 text-2xl">{g.title}</h2>
              <Accordion type="single" collapsible>
                {g.items.map(([q, a]) => (
                  <AccordionItem key={q} value={q as string}>
                    <AccordionTrigger className="text-left text-sm normal-case">{q}</AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                      {a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}