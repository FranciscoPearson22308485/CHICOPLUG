import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Loader2, Smartphone } from "lucide-react";
import { DEMO_CART, MUNICIPALITIES, PROVINCES, formatKz } from "@/lib/catalog";
import { Reveal } from "@/components/site/Reveal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — CHICOPLUG" },
      { name: "description", content: "Finaliza a tua encomenda CHICOPLUG com Multicaixa Express." },
      { property: "og:title", content: "Checkout — CHICOPLUG" },
      { property: "og:description", content: "Pagamento por Multicaixa Express." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const [province, setProvince] = useState<string>("");
  const [state, setState] = useState<"idle" | "pending">("idle");

  const subtotal = DEMO_CART.reduce((s, l) => s + l.product.price * l.quantity, 0);
  const envio = subtotal > 100000 ? 0 : 3500;

  return (
    <div className="shell pb-28 pt-14 md:pt-20">
      <Reveal>
        <p className="eyebrow">Passo final</p>
        <h1 className="mt-5 text-5xl sm:text-6xl xl:text-7xl">Checkout</h1>
      </Reveal>

      <div className="mt-16 grid gap-16 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-24">
        <form
          className="space-y-12"
          onSubmit={(e) => {
            e.preventDefault();
            setState("pending");
          }}
        >
          <fieldset className="space-y-6">
            <legend className="eyebrow mb-6">Dados de contacto</legend>
            <Field id="nome" label="Nome completo" placeholder="Nome e apelido" />
            <div className="grid gap-6 sm:grid-cols-2">
              <Field id="telefone" label="Telefone" placeholder="+244 900 000 000" type="tel" />
              <Field id="email" label="Email" placeholder="o.teu@email.com" type="email" />
            </div>
          </fieldset>

          <fieldset className="space-y-6">
            <legend className="eyebrow mb-6">Entrega</legend>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.16em]">Província</Label>
                <Select value={province} onValueChange={setProvince}>
                  <SelectTrigger className="h-12 rounded-none border-border">
                    <SelectValue placeholder="Seleciona" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {PROVINCES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.16em]">Município</Label>
                <Select disabled={!province}>
                  <SelectTrigger className="h-12 rounded-none border-border">
                    <SelectValue placeholder={province ? "Seleciona" : "Escolhe a província"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {(MUNICIPALITIES[province] ?? []).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Field id="morada" label="Morada" placeholder="Rua, nº, bairro, ponto de referência" />
            <div className="space-y-2">
              <Label htmlFor="obs" className="text-[11px] uppercase tracking-[0.16em]">
                Observações
              </Label>
              <Textarea
                id="obs"
                rows={4}
                placeholder="Indicações para a entrega (opcional)"
                className="rounded-none border-border"
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="eyebrow mb-6">Método de pagamento</legend>
            <div className="border border-foreground p-6">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <Smartphone className="size-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">Multicaixa Express</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Confirmação na app do teu banco
                    </p>
                  </div>
                </div>
                <span className="size-3 shrink-0 bg-brand" />
              </div>
            </div>

            {/* Espaço reservado para confirmação de pagamento */}
            <div
              className={cn(
                "mt-6 border border-dashed border-border p-6 transition-colors",
                state === "pending" && "border-brand",
              )}
              aria-live="polite"
            >
              {state === "idle" ? (
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Espaço reservado — confirmação do pagamento aparecerá aqui
                </p>
              ) : (
                <div className="flex items-center gap-4">
                  <Loader2 className="size-5 shrink-0 animate-spin" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">A aguardar confirmação…</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Confirma o pagamento na app Multicaixa Express
                    </p>
                  </div>
                </div>
              )}
            </div>
          </fieldset>

          <button
            type="submit"
            className="w-full bg-foreground py-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-brand hover:text-brand-foreground"
          >
            Pagar {formatKz(subtotal + envio)}
          </button>
        </form>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="border border-border p-8">
            <h2 className="text-2xl">A tua encomenda</h2>
            <ul className="mt-8 space-y-6">
              {DEMO_CART.map((l) => (
                <li key={l.product.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-4">
                  <img
                    src={l.product.images[0]}
                    alt={l.product.name}
                    loading="lazy"
                    className="aspect-[4/5] w-16 shrink-0 bg-surface object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{l.product.name}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {l.color} · {l.size} · {l.quantity}x
                    </p>
                  </div>
                  <p className="shrink-0 text-[13px]">{formatKz(l.product.price * l.quantity)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-8 space-y-4 border-t border-border pt-6 text-sm">
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
                <dd>{formatKz(subtotal + envio)}</dd>
              </div>
            </dl>
            <ul className="mt-8 space-y-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <li className="flex items-center gap-3">
                <Check className="size-4" /> Entrega 24–72h em Luanda
              </li>
              <li className="flex items-center gap-3">
                <Check className="size-4" /> Trocas em 7 dias
              </li>
            </ul>
            <Link
              to="/carrinho"
              className="link-underline mt-8 inline-block text-[11px] font-semibold uppercase tracking-[0.2em]"
            >
              Voltar ao carrinho
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[11px] uppercase tracking-[0.16em]">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        className="h-12 rounded-none border-border"
      />
    </div>
  );
}