import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { AdminButton, AdminHeading, DataTable } from "@/components/site/AdminUI";
import { Badge, Spinner } from "@/components/site/Primitives";
import { formatKz, type Order, type OrderStatus } from "@/lib/catalog";
import { ApiError } from "@/lib/api";
import { adminApi, downloadOrdersCsv } from "@/lib/admin-api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/encomendas")({
  component: AdminEncomendas,
});

const TONE: Record<OrderStatus, "dark" | "brand" | "muted"> = {
  NOVA: "muted",
  CONFIRMADA: "brand",
  EM_PREPARACAO: "brand",
  ENVIADA: "dark",
  ENTREGUE: "dark",
  CANCELADA: "muted",
};

const FILTERS = [
  { value: "todas", label: "Todas" },
  { value: "NOVA", label: "Nova" },
  { value: "CONFIRMADA", label: "Confirmada" },
  { value: "EM_PREPARACAO", label: "Em preparação" },
  { value: "ENVIADA", label: "Enviada" },
  { value: "ENTREGUE", label: "Entregue" },
  { value: "CANCELADA", label: "Cancelada" },
];

function AdminEncomendas() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todas");
  const [detail, setDetail] = useState<Order | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-encomendas", search, status],
    queryFn: () =>
      adminApi.orders({
        search: search || undefined,
        status: status === "todas" ? undefined : status,
        pageSize: 50,
      }),
  });

  const orders = data?.orders ?? [];

  const changeStatus = async (order: Order, next: OrderStatus) => {
    try {
      const result = await adminApi.setOrderStatus(order.id, next);
      await queryClient.invalidateQueries({ queryKey: ["admin-encomendas"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setDetail(result.order);
      toast.success(`${order.reference} → ${result.order.statusLabel}`);
    } catch (error) {
      // A máquina de estados do backend recusa transições impossíveis.
      toast.error(error instanceof ApiError ? error.message : "Transição não permitida.");
    }
  };

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
        title="Encomendas"
        action={<AdminButton onClick={() => void exportCsv()}>Exportar</AdminButton>}
      />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
        <div className="flex items-center gap-3 border border-border bg-background px-5 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Referência, cliente ou email…"
            aria-label="Procurar encomendas"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-auto rounded-none border-border bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-none">
            {FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner className="size-6" />
        </div>
      ) : orders.length === 0 ? (
        <div className="border border-border bg-background px-5 py-16 text-center text-sm text-muted-foreground">
          Nenhuma encomenda corresponde a estes filtros.
        </div>
      ) : (
        <DataTable
          columns={["Ref.", "Cliente", "Destino", "Total", "Pagamento", "Estado", ""]}
          rows={orders.map((o) => [
            o.reference,
            o.customerName,
            <span className="text-muted-foreground">
              {o.shipping_address.province} / {o.shipping_address.municipality}
            </span>,
            formatKz(o.total),
            <Badge tone={o.payment?.status === "PAGO" ? "brand" : "muted"}>
              {o.payment?.status ?? "—"}
            </Badge>,
            <Badge tone={TONE[o.status]}>{o.statusLabel}</Badge>,
            <button
              onClick={() => setDetail(o)}
              className="link-underline text-[11px] font-semibold uppercase tracking-[0.16em]"
            >
              Detalhes
            </button>,
          ])}
        />
      )}

      <Dialog open={Boolean(detail)} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-none">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{detail.reference}</DialogTitle>
              </DialogHeader>

              <div className="mt-6 space-y-8">
                <section>
                  <p className="eyebrow mb-4">Cliente</p>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p className="text-foreground">{detail.customerName}</p>
                    <p>{detail.email}</p>
                    <p>{detail.phone}</p>
                    <p className="pt-2">
                      {detail.shipping_address.street}, {detail.shipping_address.municipality},{" "}
                      {detail.shipping_address.province}
                    </p>
                    {detail.shipping_address.notes && (
                      <p className="italic">{detail.shipping_address.notes}</p>
                    )}
                  </div>
                </section>

                <section>
                  <p className="eyebrow mb-4">Peças</p>
                  <ul className="space-y-3">
                    {detail.items.map((item) => (
                      <li
                        key={item.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-border pb-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate">{item.productName}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            {item.colorName} · {item.size} · {item.quantity}x
                          </p>
                        </div>
                        <p>{formatKz(item.lineTotal)}</p>
                      </li>
                    ))}
                  </ul>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Subtotal</dt>
                      <dd>{formatKz(detail.subtotal)}</dd>
                    </div>
                    {detail.discount > 0 && (
                      <div className="flex justify-between text-brand">
                        <dt>Desconto</dt>
                        <dd>−{formatKz(detail.discount)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Envio</dt>
                      <dd>{detail.shipping === 0 ? "Grátis" : formatKz(detail.shipping)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 font-semibold">
                      <dt>Total</dt>
                      <dd>{formatKz(detail.total)}</dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <p className="eyebrow mb-4">Histórico</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {detail.events.map((event) => (
                      <li key={event.id} className="flex gap-3">
                        <span className="shrink-0 text-[11px] uppercase tracking-[0.14em]">
                          {new Date(event.createdAt).toLocaleString("pt-PT")}
                        </span>
                        <span>{event.note ?? event.to}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <p className="eyebrow mb-4">Alterar estado</p>
                  {(detail.allowedTransitions?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Esta encomenda está num estado final.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {detail.allowedTransitions?.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => void changeStatus(detail, t.value)}
                          className="border border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
