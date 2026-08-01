import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ArrowRight, AlertTriangle } from "lucide-react";
import { formatKz } from "@/lib/catalog";
import { EmptyState, ProductSkeleton } from "@/components/site/Primitives";
import { Reveal } from "@/components/site/Reveal";
import { useCart } from "@/context/cart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho — CHICOPLUG" },
      { name: "description", content: "Revê as tuas peças antes de finalizar a encomenda." },
      { property: "og:title", content: "Carrinho — CHICOPLUG" },
      { property: "og:description", content: "Revê as tuas peças antes de finalizar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Carrinho,
});

function Carrinho() {
  const { cart, loading, pending, updateItem, removeItem } = useCart();

  const lines = cart?.lines ?? [];
  const subtotal = cart?.subtotal ?? 0;
  const envio = cart?.shipping ?? 0;
  const total = cart?.total ?? 0;

  return (
    <div className="shell pb-28 pt-14 md:pt-20">
      <Reveal>
        <p className="eyebrow">Encomenda</p>
        <h1 className="mt-5 text-5xl sm:text-6xl xl:text-7xl">Carrinho</h1>
      </Reveal>

      {loading ? (
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <ProductSkeleton key={i} />
          ))}
        </div>
      ) : lines.length === 0 ? (
        <div className="mt-16">
          <EmptyState
            title="O carrinho está vazio"
            description="Ainda não escolheste nenhuma peça. Explora as novidades da loja."
            action={
              <Link
                to="/shop"
                className="bg-foreground px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-background"
              >
                Shop Now
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-16 grid gap-16 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-24">
          <div className="border-t border-border">
            {lines.map((line) => (
              <div
                key={line.id}
                className="grid grid-cols-[88px_minmax(0,1fr)] gap-5 border-b border-border py-8 md:grid-cols-[120px_minmax(0,1fr)] md:gap-8"
              >
                <Link
                  to="/produto/$slug"
                  params={{ slug: line.product.slug }}
                  className="shrink-0 bg-surface"
                >
                  <img
                    src={line.product.images[0]}
                    alt={line.product.name}
                    loading="lazy"
                    className="aspect-[4/5] w-full object-cover"
                  />
                </Link>
                <div className="min-w-0">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
                    <div className="min-w-0">
                      <h2 className="truncate text-base normal-case tracking-tight">
                        {line.product.name}
                      </h2>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {line.color} · {line.size}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold">{formatKz(line.lineTotal)}</p>
                  </div>

                  {/* Entre adicionar ao carrinho e finalizar podem passar dias:
                      se o stock caiu entretanto, o cliente tem de saber já aqui
                      e não só ao ver o checkout falhar. */}
                  {line.exceedsStock && (
                    <p className="mt-3 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-brand">
                      <AlertTriangle className="size-3.5" />
                      Só restam {line.availableStock} un.
                    </p>
                  )}

                  <div className="mt-6 flex items-center gap-6">
                    <div className="flex items-center border border-border">
                      <button
                        aria-label="Diminuir"
                        disabled={pending || line.quantity <= 1}
                        onClick={() => void updateItem(line.id, line.quantity - 1)}
                        className="grid size-9 place-items-center hover:bg-muted disabled:opacity-40"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-semibold">{line.quantity}</span>
                      <button
                        aria-label="Aumentar"
                        disabled={pending || line.quantity >= line.availableStock}
                        onClick={() => void updateItem(line.id, line.quantity + 1)}
                        className="grid size-9 place-items-center hover:bg-muted disabled:opacity-40"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <button
                      disabled={pending}
                      onClick={() => void removeItem(line.id)}
                      className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" /> Remover
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="border border-border p-8">
              <h2 className="text-2xl">Resumo</h2>
              <dl className="mt-8 space-y-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd>{formatKz(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Envio</dt>
                  <dd>{envio === 0 ? "Grátis" : formatKz(envio)}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-4 text-base font-semibold">
                  <dt>Total</dt>
                  <dd>{formatKz(total)}</dd>
                </div>
              </dl>

              {cart && cart.amountToFreeShipping > 0 && (
                <p className="mt-6 border border-dashed border-border px-4 py-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Faltam {formatKz(cart.amountToFreeShipping)} para envio grátis
                </p>
              )}

              <Link
                to="/checkout"
                className={cn(
                  "group mt-8 flex items-center justify-center gap-3 bg-foreground py-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-brand hover:text-brand-foreground",
                  pending && "pointer-events-none opacity-60",
                )}
              >
                Finalizar compra
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
                Pagamento por Multicaixa Express. Envio grátis acima de{" "}
                {formatKz(cart?.freeShippingThreshold ?? 100000)}.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
