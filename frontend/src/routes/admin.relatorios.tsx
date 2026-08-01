import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminButton, AdminHeading, DataTable, StatCard } from "@/components/site/AdminUI";
import { Spinner } from "@/components/site/Primitives";
import { formatKz } from "@/lib/catalog";
import { adminApi, downloadOrdersCsv } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/relatorios")({
  component: AdminRelatorios,
});

const WINDOWS = [
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "1 ano" },
];

function AdminRelatorios() {
  const [days, setDays] = useState(180);

  const { data: report, isLoading } = useQuery({
    queryKey: ["admin-relatorios", days],
    queryFn: () => adminApi.reports(days),
  });

  const { data: dashboard } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.dashboard(),
  });

  const monthly = dashboard?.monthly ?? [];
  // Evita divisão por zero quando ainda não há vendas — sem isto as barras
  // ficariam com `height: NaN%` e desapareciam.
  const max = Math.max(1, ...monthly.map((m) => m.orders));

  const exportCsv = async () => {
    try {
      await downloadOrdersCsv();
    } catch {
      toast.error("Não foi possível exportar.");
    }
  };

  return (
    <div className="space-y-10">
      <AdminHeading
        title="Relatórios"
        action={<AdminButton onClick={() => void exportCsv()}>Exportar CSV</AdminButton>}
      />

      <div className="flex flex-wrap gap-3">
        {WINDOWS.map((w) => (
          <button
            key={w.days}
            onClick={() => setDays(w.days)}
            className={cn(
              "border px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors",
              days === w.days
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background hover:border-foreground",
            )}
          >
            {w.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner className="size-6" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Receita" value={formatKz(report?.revenue ?? 0)} />
            <StatCard label="Peças vendidas" value={String(report?.itemsSold ?? 0)} />
            <StatCard label="Descontos concedidos" value={formatKz(report?.discountGiven ?? 0)} />
            <StatCard
              label="Taxa de cancelamento"
              value={`${report?.cancellationRate ?? 0}%`}
              delta={`${report?.cancelledOrders ?? 0} canceladas`}
            />
          </div>

          <div className="border border-border bg-background p-6">
            <p className="eyebrow mb-8">Encomendas por mês</p>
            {monthly.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Sem dados suficientes para o gráfico.
              </p>
            ) : (
              <div className="flex h-52 items-end gap-3 sm:gap-6">
                {monthly.map((m) => (
                  <div
                    key={`${m.month}-${m.year}`}
                    className="flex min-w-0 flex-1 flex-col items-center gap-3"
                    title={`${m.orders} encomendas · ${formatKz(m.revenue)}`}
                  >
                    <div
                      className="w-full bg-foreground transition-all duration-700"
                      style={{ height: `${(m.orders / max) * 100}%` }}
                    />
                    <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {m.month}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="eyebrow mb-4">Peças mais vendidas</p>
            {(report?.topProducts.length ?? 0) === 0 ? (
              <div className="border border-border bg-background px-5 py-16 text-center text-sm text-muted-foreground">
                Ainda não há vendas neste período.
              </div>
            ) : (
              <DataTable
                columns={["Peça", "Unidades", "Receita"]}
                rows={(report?.topProducts ?? []).map((p) => [
                  p.productName,
                  `${p.quantity}`,
                  formatKz(p.revenue),
                ])}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
