import { createFileRoute } from "@tanstack/react-router";
import { AdminButton, AdminHeading, DataTable } from "@/components/site/AdminUI";
import { Badge } from "@/components/site/Primitives";
import { formatKz } from "@/lib/catalog";

export const Route = createFileRoute("/admin/encomendas")({
  component: AdminEncomendas,
});

const ROWS = [
  ["CP-2044", "Ana Miguel", "Luanda / Talatona", 110000, "Pago"],
  ["CP-2043", "Nuno Cardoso", "Benguela / Lobito", 78000, "Enviado"],
  ["CP-2042", "Sara Lopes", "Luanda / Viana", 142000, "Pendente"],
  ["CP-2041", "Kito Bernardo", "Huíla / Lubango", 32000, "Entregue"],
  ["CP-2040", "Rita Manuel", "Luanda / Belas", 64000, "Cancelada"],
] as const;

function AdminEncomendas() {
  return (
    <div className="space-y-10">
      <AdminHeading title="Encomendas" action={<AdminButton>Exportar</AdminButton>} />
      <DataTable
        columns={["Ref.", "Cliente", "Destino", "Total", "Estado"]}
        rows={ROWS.map((r) => [
          r[0],
          r[1],
          <span className="text-muted-foreground">{r[2]}</span>,
          formatKz(r[3]),
          <Badge tone={r[4] === "Pago" ? "brand" : r[4] === "Cancelada" ? "muted" : "dark"}>
            {r[4]}
          </Badge>,
        ])}
      />
    </div>
  );
}