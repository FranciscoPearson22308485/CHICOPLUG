import { createFileRoute } from "@tanstack/react-router";
import { AdminHeading, DataTable, StatCard } from "@/components/site/AdminUI";
import { Badge } from "@/components/site/Primitives";
import { PRODUCTS, formatKz } from "@/lib/catalog";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="space-y-10">
      <AdminHeading title="Dashboard" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Vendas (30d)" value={formatKz(4820000)} delta="+18% vs. mês anterior" />
        <StatCard label="Encomendas" value="128" delta="+12 hoje" />
        <StatCard label="Ticket médio" value={formatKz(76500)} delta="+4%" />
        <StatCard label="Taxa de conversão" value="3,4%" delta="+0,6 p.p." />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <p className="eyebrow mb-4">Encomendas recentes</p>
          <DataTable
            columns={["Ref.", "Cliente", "Total", "Estado"]}
            rows={[
              ["CP-2044", "Ana M.", formatKz(110000), <Badge tone="brand">Pago</Badge>],
              ["CP-2043", "Nuno C.", formatKz(78000), <Badge tone="dark">Enviado</Badge>],
              ["CP-2042", "Sara L.", formatKz(142000), <Badge tone="muted">Pendente</Badge>],
              ["CP-2041", "Kito B.", formatKz(32000), <Badge tone="dark">Entregue</Badge>],
            ]}
          />
        </div>
        <div>
          <p className="eyebrow mb-4">Stock crítico</p>
          <div className="space-y-3">
            {PRODUCTS.filter((p) => p.stock <= 6).map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border border-border bg-background px-5 py-4"
              >
                <p className="truncate text-sm">{p.name}</p>
                <Badge tone={p.stock === 0 ? "muted" : "brand"}>{p.stock} un.</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}