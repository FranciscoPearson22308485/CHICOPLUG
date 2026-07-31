import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — CHICOPLUG" },
      {
        name: "description",
        content: "Como a CHICOPLUG recolhe, usa e protege os dados pessoais dos seus clientes.",
      },
      { property: "og:title", content: "Política de Privacidade — CHICOPLUG" },
      { property: "og:description", content: "Como tratamos e protegemos os teus dados." },
    ],
  }),
  component: () => (
    <LegalPage
      eyebrow="Legal"
      title="Política de Privacidade"
      updated="Janeiro de 2026"
      sections={[
        {
          title: "1. Dados recolhidos",
          body: [
            "Recolhemos nome, telefone, email e morada de entrega para processar encomendas, além de dados técnicos de navegação agregados.",
          ],
        },
        {
          title: "2. Finalidade",
          body: [
            "Os dados são usados exclusivamente para processar encomendas, prestar apoio ao cliente e, com consentimento, enviar comunicações sobre drops.",
          ],
        },
        {
          title: "3. Partilha",
          body: [
            "Partilhamos apenas o necessário com transportadoras e o processador de pagamentos. Nunca vendemos dados a terceiros.",
          ],
        },
        {
          title: "4. Conservação",
          body: ["Mantemos os dados de encomenda pelo período legal exigido em Angola e apagamos o restante a pedido."],
        },
        {
          title: "5. Os teus direitos",
          body: [
            "Podes pedir acesso, correção ou eliminação dos teus dados através de ola@chicoplug.ao.",
          ],
        },
      ]}
    />
  ),
});