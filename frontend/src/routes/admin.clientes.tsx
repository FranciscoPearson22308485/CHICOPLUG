import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { AdminHeading, DataTable } from "@/components/site/AdminUI";
import { Badge, Spinner } from "@/components/site/Primitives";
import { formatKz } from "@/lib/catalog";
import { ApiError } from "@/lib/api";
import { adminApi, type AdminCustomer } from "@/lib/admin-api";
import { useAuth } from "@/context/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/clientes")({
  component: AdminClientes,
});

function AdminClientes() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<AdminCustomer | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-clientes", search],
    queryFn: () => adminApi.customers({ search: search || undefined, pageSize: 50 }),
  });

  const customers = data?.customers ?? [];

  const update = async (customer: AdminCustomer, patch: Record<string, unknown>) => {
    try {
      const result = await adminApi.updateCustomer(customer.id, patch);
      await queryClient.invalidateQueries({ queryKey: ["admin-clientes"] });
      setDetail(result.customer);
      toast.success("Cliente actualizado");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Não foi possível actualizar.");
    }
  };

  return (
    <div className="space-y-10">
      <AdminHeading title="Clientes" />

      <div className="flex items-center gap-3 border border-border bg-background px-5 py-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nome ou email…"
          aria-label="Procurar clientes"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {isLoading ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner className="size-6" />
        </div>
      ) : (
        <DataTable
          columns={["Nome", "Email", "Encomendas", "Total gasto", "Perfil", ""]}
          rows={customers.map((c) => [
            <span className={c.active ? "" : "text-muted-foreground line-through"}>{c.name}</span>,
            <span className="text-muted-foreground">{c.email}</span>,
            `${c.orderCount}`,
            formatKz(c.totalSpent),
            <Badge tone={c.role === "ADMIN" ? "brand" : "muted"}>
              {c.role === "ADMIN" ? "Admin" : "Cliente"}
            </Badge>,
            <button
              onClick={() => setDetail(c)}
              className="link-underline text-[11px] font-semibold uppercase tracking-[0.16em]"
            >
              Gerir
            </button>,
          ])}
        />
      )}

      <Dialog open={Boolean(detail)} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="rounded-none sm:max-w-md">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{detail.name}</DialogTitle>
              </DialogHeader>

              <div className="mt-6 space-y-6">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{detail.email}</p>
                  {detail.phone && <p>{detail.phone}</p>}
                  <p>
                    Cliente desde {new Date(detail.createdAt).toLocaleDateString("pt-PT")} ·{" "}
                    {detail.orderCount} encomenda(s) · {formatKz(detail.totalSpent)}
                  </p>
                </div>

                {/* O backend impede um admin de se despromover ou desactivar a
                    si próprio; desactivamos os controlos para não o sugerir. */}
                <div className="space-y-4 border-t border-border pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Administrador</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Acesso total ao painel
                      </p>
                    </div>
                    <Switch
                      checked={detail.role === "ADMIN"}
                      disabled={detail.id === user?.id}
                      onCheckedChange={(v) =>
                        void update(detail, { role: v ? "ADMIN" : "USER" })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Conta activa</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Desactivar termina as sessões abertas
                      </p>
                    </div>
                    <Switch
                      checked={detail.active}
                      disabled={detail.id === user?.id}
                      onCheckedChange={(v) => void update(detail, { active: v })}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
