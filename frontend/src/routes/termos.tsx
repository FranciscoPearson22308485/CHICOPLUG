import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos e Condições — CHICOPLUG" },
      {
        name: "description",
        content: "Termos e condições de utilização da loja online CHICOPLUG e de compra das peças.",
      },
      { property: "og:title", content: "Termos e Condições — CHICOPLUG" },
      { property: "og:description", content: "Regras de utilização e de compra na loja." },
    ],
  }),
  component: () => (
    <LegalPage
      eyebrow="Legal"
      title="Termos e Condições"
      updated="Janeiro de 2026"
      sections={[
        {
          title: "1. Âmbito",
          body: [
            "Estes termos regulam a utilização da loja online CHICOPLUG e a compra de peças através dela.",
          ],
        },
        {
          title: "2. Encomendas",
          body: [
            "A encomenda só é considerada aceite após confirmação do pagamento. Reservamos o direito de cancelar encomendas com dados incorretos ou suspeita de fraude.",
          ],
        },
        {
          title: "3. Preços e stock",
          body: [
            "Todos os preços estão em Kwanzas e incluem impostos aplicáveis. O stock é limitado e pode esgotar durante o processo de compra.",
          ],
        },
        {
          title: "4. Propriedade intelectual",
          body: [
            "Marca, imagens, textos e desenhos são propriedade da CHICOPLUG e não podem ser reproduzidos sem autorização escrita.",
          ],
        },
        {
          title: "5. Lei aplicável",
          body: ["Estes termos regem-se pela lei angolana."],
        },
      ]}
    />
  ),
});
