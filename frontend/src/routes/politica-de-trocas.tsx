import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/politica-de-trocas")({
  head: () => ({
    meta: [
      { title: "Política de Trocas — CHICOPLUG" },
      {
        name: "description",
        content:
          "Condições de troca e devolução das peças CHICOPLUG: prazos, estado das peças e custos.",
      },
      { property: "og:title", content: "Política de Trocas — CHICOPLUG" },
      { property: "og:description", content: "Prazos, condições e custos de troca." },
    ],
  }),
  component: () => (
    <LegalPage
      eyebrow="Legal"
      title="Política de Trocas"
      updated="Janeiro de 2026"
      sections={[
        {
          title: "1. Prazo",
          body: [
            "Aceitamos pedidos de troca até 7 dias após a receção da encomenda. Pedidos fora deste prazo não são processados.",
          ],
        },
        {
          title: "2. Estado da peça",
          body: [
            "A peça deve estar sem uso, sem lavagem, sem odores e com todas as etiquetas originais intactas.",
          ],
        },
        {
          title: "3. Como pedir",
          body: [
            "Envia o número da encomenda e o motivo para ola@chicoplug.ao. A equipa confirma a elegibilidade em 24 horas úteis.",
          ],
        },
        {
          title: "4. Custos",
          body: [
            "Trocas por tamanho em Luanda são gratuitas. Nas restantes províncias o custo de recolha é do cliente.",
            "Peças com defeito de fabrico são substituídas ou reembolsadas sem qualquer custo.",
          ],
        },
        {
          title: "5. Peças excluídas",
          body: [
            "Acessórios de uso pessoal e peças de arquivo em saldo final não são elegíveis para troca.",
          ],
        },
      ]}
    />
  ),
});
