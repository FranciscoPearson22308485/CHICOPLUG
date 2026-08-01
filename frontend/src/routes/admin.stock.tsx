import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { AdminButton, AdminHeading, DataTable } from "@/components/site/AdminUI";
import { Badge, Spinner } from "@/components/site/Primitives";
import { ApiError } from "@/lib/api";
import { adminApi } from "@/lib/admin-api";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/stock")({
  component: AdminStock,
});

function AdminStock() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  /** Ajustes por confirmar, indexados por variante. */
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-stock", search, lowOnly],
    queryFn: () => adminApi.stock({ search: search || undefined, lowOnly, pageSize: 100 }),
  });

  const { data: alerts } = useQuery({
    queryKey: ["admin-stock-alertas"],
    queryFn: () => adminApi.stockAlerts(),
  });

  const variants = data?.variants ?? [];
  const pendingCount = Object.keys(draft).length;

  const applyAdjustments = async () => {
    const adjustments = Object.entries(draft)
      .map(([variantId, value]) => ({
        variantId,
        quantity: Number(value),
        // Valor absoluto: o admin escreve o stock que contou na prateleira.
        mode: "set" as const,
      }))
      .filter((a) => Number.isFinite(a.quantity) && a.quantity >= 0);

    if (adjustments.length === 0) return;

    setSaving(true);
    try {
      const result = await adminApi.adjustStock(adjustments);
      await queryClient.invalidateQueries({ queryKey: ["admin-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-stock-alertas"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setDraft({});
      toast.success(`${result.adjustments.length} variante(s) actualizada(s)`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Não foi possível ajustar o stock.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      <AdminHeading
        title="Stock"
        action={
          <AdminButton
            onClick={() => void applyAdjustments()}
            disabled={pendingCount === 0 || saving}
          >
            {saving ? "A guardar…" : `Aplicar ${pendingCount > 0 ? `(${pendingCount})` : ""}`}
          </AdminButton>
        }
      />

      {alerts && (alerts.outOfStock > 0 || alerts.critical > 0) && (
        <div className="flex flex-wrap gap-4 border border-border bg-background p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Alertas de stock
          </p>
          <Badge tone="muted">{alerts.outOfStock} sem stock</Badge>
          <Badge tone="brand">{alerts.critical} em nível crítico</Badge>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex items-center gap-3 border border-border bg-background px-5 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Produto ou SKU…"
            aria-label="Procurar no inventário"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button
          onClick={() => setLowOnly((v) => !v)}
          aria-pressed={lowOnly}
          className={cn(
            "border px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors",
            lowOnly
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background hover:border-foreground",
          )}
        >
          Só críticos
        </button>
      </div>

      {isLoading ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner className="size-6" />
        </div>
      ) : (
        <DataTable
          columns={["Peça", "Variante", "SKU", "Unidades", "Novo valor", "Alerta"]}
          rows={variants.map((v) => [
            <span className="truncate">{v.productName}</span>,
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <span
                className="size-3 shrink-0 border border-border"
                style={{ backgroundColor: v.colorHex }}
              />
              {v.size} · {v.colorName}
            </span>,
            <span className="text-[11px] text-muted-foreground">{v.sku}</span>,
            `${v.stock}`,
            <Input
              type="number"
              min={0}
              value={draft[v.id] ?? ""}
              placeholder={String(v.stock)}
              onChange={(e) =>
                setDraft((prev) => {
                  const next = { ...prev };
                  if (e.target.value === "") delete next[v.id];
                  else next[v.id] = e.target.value;
                  return next;
                })
              }
              className="h-9 w-24 rounded-none border-border"
            />,
            v.status === "SEM_STOCK" ? (
              <Badge tone="muted">Sem stock</Badge>
            ) : v.status === "CRITICO" ? (
              <Badge tone="brand">Crítico</Badge>
            ) : (
              <Badge tone="dark">OK</Badge>
            ),
          ])}
        />
      )}
    </div>
  );
}
