import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminHeading, DataTable, StatCard } from "@/components/site/AdminUI";
import { Badge, Spinner } from "@/components/site/Primitives";
import { formatKz, type OrderStatus } from "@/lib/catalog";
import { adminApi } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

const TONE: Record<OrderStatus, "dark" | "brand" | "muted"> = {
  NOVA: "muted",
  CONFIRMADA: "brand",
  EM_PREPARACAO: "brand",
  ENVIADA: "dark",
  ENTREGUE: "dark",
  CANCELADA: "muted",
};

/**
 * Formata a variação percentual. `null` significa que não havia período
 * anterior para comparar — mostrar "+100%" nesse caso seria inventar um facto.
 */
function delta(value: number | null, suffix = "vs. período anterior"): string | undefined {
  if (value === null) return "sem histórico para comparar";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}% ${suffix}`;
}

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.dashboard(),
    // Um painel aberto num monitor de escritório deve manter-se actual.
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  const m = data?.metrics;

  return (
    <div className="space-y-10">
      <AdminHeading title="Dashboard" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Vendas (30d)"
          value={formatKz(m?.revenue30d ?? 0)}
          {...(delta(m?.revenueDelta ?? null) ? { delta: delta(m?.revenueDelta ?? null)! } : {})}
        />
        <StatCard
          label="Encomendas"
          value={String(m?.orders30d ?? 0)}
          delta={`+${m?.ordersToday ?? 0} hoje`}
        />
        <StatCard
          label="Ticket médio"
          value={formatKz(m?.averageTicket ?? 0)}
          {...(delta(m?.averageTicketDelta ?? null)
            ? { delta: delta(m?.averageTicketDelta ?? null)! }
            : {})}
        />
        <StatCard
          label="Clientes"
          value={String(m?.customerCount ?? 0)}
          delta={`${m?.productCount ?? 0} produtos activos`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <p className="eyebrow mb-4">Encomendas recentes</p>
          {(data?.recentOrders.length ?? 0) === 0 ? (
            <div className="border border-border bg-background px-5 py-10 text-center text-sm text-muted-foreground">
              Ainda não há encomendas.
            </div>
          ) : (
            <DataTable
              columns={["Ref.", "Cliente", "Total", "Estado"]}
              rows={(data?.recentOrders ?? []).map((o) => [
                o.reference,
                o.customerName,
                formatKz(o.total),
                <Badge tone={TONE[o.status]}>{o.statusLabel}</Badge>,
              ])}
            />
          )}
        </div>
        <div>
          <p className="eyebrow mb-4">Stock crítico</p>
          <div className="space-y-3">
            {(data?.lowStock.length ?? 0) === 0 ? (
              <div className="border border-border bg-background px-5 py-10 text-center text-sm text-muted-foreground">
                Nenhum alerta de stock.
              </div>
            ) : (
              (data?.lowStock ?? []).map((v) => (
                <div
                  key={v.variantId}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border border-border bg-background px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{v.productName}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {v.size} · {v.colorName}
                    </p>
                  </div>
                  <Badge tone={v.stock === 0 ? "muted" : "brand"}>{v.stock} un.</Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
