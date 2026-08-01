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
        content:
          "Perguntas frequentes sobre autenticidade, marcas, tamanhos, envios, pagamentos e trocas na CHICOPLUG.",
      },
      { property: "og:title", content: "FAQ — CHICOPLUG" },
      {
        property: "og:description",
        content: "Autenticidade, tamanhos, envios, pagamentos e trocas.",
      },
    ],
  }),
  component: Faq,
});

const GROUPS = [
  {
    title: "Autenticidade",
    items: [
      [
        "As peças são originais?",
        "Sim. Trabalhamos apenas com fornecedores verificados e cada peça é conferida antes de entrar no catálogo. Não vendemos réplicas.",
      ],
      [
        "Que marcas têm disponíveis?",
        "Nike, Jordan, Adidas, Corteiz, Represent, Hellstar, Denim Tears, Essentials e Gallery Dept. A lista completa está na página de Marcas.",
      ],
      [
        "Fazem reposição das peças esgotadas?",
        "Depende da disponibilidade junto do fornecedor. Inscreve-te na newsletter para saberes quando uma peça volta.",
      ],
    ],
  },
  {
    title: "Tamanhos",
    items: [
      [
        "Como sei o meu tamanho?",
        "Cada peça tem a tabela de tamanhos da respectiva marca. Atenção: o corte varia entre marcas — uma L da Essentials não é igual a uma L da Nike.",
      ],
      [
        "E se errar o tamanho?",
        "Podes trocar em 7 dias, desde que a peça esteja intacta e com etiqueta.",
      ],
    ],
  },
  {
    title: "Envios e pagamentos",
    items: [
      [
        "Enviam para todas as províncias?",
        "Sim. Luanda em 24–72h; restantes províncias entre 3 e 7 dias úteis.",
      ],
      [
        "Que métodos de pagamento aceitam?",
        "Multicaixa Express. Outros métodos serão adicionados em breve.",
      ],
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
                    <AccordionTrigger className="text-left text-sm normal-case">
                      {q}
                    </AccordionTrigger>
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
