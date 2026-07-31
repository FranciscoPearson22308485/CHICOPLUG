import { createFileRoute } from "@tanstack/react-router";
import { AdminButton, AdminHeading, StatCard } from "@/components/site/AdminUI";
import { formatKz } from "@/lib/catalog";

export const Route = createFileRoute("/admin/relatorios")({
  component: AdminRelatorios,
});

const MONTHS = [
  { m: "Ago", v: 42 },
  { m: "Set", v: 55 },
  { m: "Out", v: 61 },
  { m: "Nov", v: 78 },
  { m: "Dez", v: 96 },
  { m: "Jan", v: 88 },
];

function AdminRelatorios() {
  const max = Math.max(...MONTHS.map((x) => x.v));
  return (
    <div className="space-y-10">
      <AdminHeading title="Relatórios" action={<AdminButton>Exportar CSV</AdminButton>} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Receita (6m)" value={formatKz(24800000)} delta="+22%" />
        <StatCard label="Peças vendidas" value="420" delta="+64 no último mês" />
        <StatCard label="Devoluções" value="2,1%" delta="-0,4 p.p." />
      </div>

      <div className="border border-border bg-background p-6">
        <p className="eyebrow mb-8">Encomendas por mês</p>
        <div className="flex h-52 items-end gap-3 sm:gap-6">
          {MONTHS.map((x) => (
            <div key={x.m} className="flex min-w-0 flex-1 flex-col items-center gap-3">
              <div
                className="w-full bg-foreground transition-all duration-700"
                style={{ height: `${(x.v / max) * 100}%` }}
              />
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {x.m}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}