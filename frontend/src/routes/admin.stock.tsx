import { createFileRoute } from "@tanstack/react-router";
import { AdminButton, AdminHeading, DataTable } from "@/components/site/AdminUI";
import { Badge } from "@/components/site/Primitives";
import { PRODUCTS } from "@/lib/catalog";

export const Route = createFileRoute("/admin/stock")({
  component: AdminStock,
});

function AdminStock() {
  return (
    <div className="space-y-10">
      <AdminHeading title="Stock" action={<AdminButton>Ajustar stock</AdminButton>} />
      <DataTable
        columns={["Peça", "Tamanhos", "Unidades", "Alerta"]}
        rows={PRODUCTS.map((p) => [
          <span className="truncate">{p.name}</span>,
          <span className="text-muted-foreground">{p.sizes.join(" · ")}</span>,
          `${p.stock}`,
          p.stock === 0 ? (
            <Badge tone="muted">Sem stock</Badge>
          ) : p.stock <= 6 ? (
            <Badge tone="brand">Crítico</Badge>
          ) : (
            <Badge tone="dark">OK</Badge>
          ),
        ])}
      />
    </div>
  );
}