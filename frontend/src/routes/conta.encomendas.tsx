import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { formatKz, type Order, type OrderStatus } from "@/lib/catalog";
import { ordersApi } from "@/lib/queries";
import { Reveal } from "@/components/site/Reveal";
import { Badge, EmptyState, ProductSkeleton } from "@/components/site/Primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/conta/encomendas")({
  component: Encomendas,
});

/** Mapeia o estado ao `tone` do Badge — o componente visual não muda. */
const TONE: Record<OrderStatus, "dark" | "brand" | "muted"> = {
  NOVA: "muted",
  CONFIRMADA: "brand",
  EM_PREPARACAO: "brand",
  ENVIADA: "dark",
  ENTREGUE: "dark",
  CANCELADA: "muted",
};

/** Só faz sentido cancelar antes de a encomenda entrar em preparação. */
const CANCELLABLE: OrderStatus[] = ["NOVA", "CONFIRMADA"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Encomendas() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["minhas-encomendas"],
    queryFn: () => ordersApi.list(),
  });

  const orders: Order[] = data?.orders ?? [];

  const cancel = async (reference: string) => {
    try {
      await ordersApi.cancel(reference);
      await queryClient.invalidateQueries({ queryKey: ["minhas-encomendas"] });
      toast.success(`Encomenda ${reference} cancelada`);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Não foi possível cancelar a encomenda.",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        title="Sem encomendas"
        description="Ainda não fizeste nenhuma compra. Quando fizeres, o histórico aparece aqui."
        action={
          <Link
            to="/shop"
            className="bg-foreground px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-background"
          >
            Ver shop
          </Link>
        }
      />
    );
  }

  return (
    <Reveal className="border-t border-border">
      {orders.map((o) => {
        const isOpen = expanded === o.id;
        return (
          <div key={o.id} className="border-b border-border">
            <button
              onClick={() => setExpanded(isOpen ? null : o.id)}
              aria-expanded={isOpen}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-6 py-6 text-left"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">{o.reference}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {formatDate(o.createdAt)} · {o.itemCount} {o.itemCount === 1 ? "peça" : "peças"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-6">
                <Badge tone={TONE[o.status]}>{o.statusLabel}</Badge>
                <p className="text-sm font-semibold">{formatKz(o.total)}</p>
                <ChevronDown
                  className={cn("size-4 transition-transform duration-300", isOpen && "rotate-180")}
                />
              </div>
            </button>

            {isOpen && (
              <div className="pb-8">
                <ul className="space-y-4 border-t border-border pt-6">
                  {o.items.map((item) => (
                    <li key={item.id} className="grid grid-cols-[56px_minmax(0,1fr)_auto] gap-4">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          loading="lazy"
                          className="aspect-[4/5] w-14 shrink-0 bg-surface object-cover"
                        />
                      ) : (
                        <div className="aspect-[4/5] w-14 shrink-0 bg-surface" />
                      )}
                      <div className="min-w-0">
                        <Link
                          to="/produto/$slug"
                          params={{ slug: item.productSlug }}
                          className="link-underline truncate text-[13px] font-semibold"
                        >
                          {item.productName}
                        </Link>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          {item.colorName} · {item.size} · {item.quantity}x
                        </p>
                      </div>
                      <p className="shrink-0 text-[13px]">{formatKz(item.lineTotal)}</p>
                    </li>
                  ))}
                </ul>

                <dl className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd>{formatKz(o.subtotal)}</dd>
                  </div>
                  {o.discount > 0 && (
                    <div className="flex justify-between text-brand">
                      <dt>Desconto</dt>
                      <dd>−{formatKz(o.discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Envio</dt>
                    <dd>{o.shipping === 0 ? "Grátis" : formatKz(o.shipping)}</dd>
                  </div>
                </dl>

                <p className="mt-6 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Entrega: {o.shipping_address.street}, {o.shipping_address.municipality},{" "}
                  {o.shipping_address.province}
                </p>

                {CANCELLABLE.includes(o.status) && (
                  <button
                    onClick={() => void cancel(o.reference)}
                    className="link-underline mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                  >
                    Cancelar encomenda
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </Reveal>
  );
}
