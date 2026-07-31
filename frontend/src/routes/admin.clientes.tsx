import { createFileRoute } from "@tanstack/react-router";
import { AdminButton, AdminHeading, DataTable } from "@/components/site/AdminUI";
import { formatKz } from "@/lib/catalog";

export const Route = createFileRoute("/admin/clientes")({
  component: AdminClientes,
});

const ROWS = [
  ["Ana Miguel", "ana@email.ao", 6, 486000],
  ["Nuno Cardoso", "nuno@email.ao", 4, 312000],
  ["Sara Lopes", "sara@email.ao", 3, 284000],
  ["Kito Bernardo", "kito@email.ao", 2, 96000],
] as const;

function AdminClientes() {
  return (
    <div className="space-y-10">
      <AdminHeading title="Clientes" action={<AdminButton>Convidar</AdminButton>} />
      <DataTable
        columns={["Nome", "Email", "Encomendas", "Total gasto"]}
        rows={ROWS.map((r) => [
          r[0],
          <span className="text-muted-foreground">{r[1]}</span>,
          `${r[2]}`,
          formatKz(r[3]),
        ])}
      />
    </div>
  );
}