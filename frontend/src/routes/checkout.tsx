import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Check, CheckCircle2, Loader2, Smartphone, XCircle } from "lucide-react";
import { toast } from "sonner";
import { MUNICIPALITIES, PROVINCES, formatKz, type Order } from "@/lib/catalog";
import { ApiError } from "@/lib/api";
import { ordersApi, paymentsApi, type PaymentInfo } from "@/lib/queries";
import { useAuth } from "@/context/auth";
import { useCart } from "@/context/cart";
import { Reveal } from "@/components/site/Reveal";
import { EmptyState } from "@/components/site/Primitives";
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

/** Estados do painel de pagamento, que o design já reservava. */
type Phase = "idle" | "submitting" | "pending" | "paid" | "failed";

function Checkout() {
  const { cart, loading, refresh } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [province, setProvince] = useState<string>("");
  const [municipality, setMunicipality] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);

  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const lines = cart?.lines ?? [];
  const subtotal = cart?.subtotal ?? 0;
  const discount = coupon?.discount ?? 0;
  const envio = cart?.shipping ?? 0;
  const total = Math.max(0, subtotal - discount) + envio;

  /**
   * Polling do estado do pagamento.
   *
   * O Multicaixa Express é assíncrono: o cliente confirma na app do banco e o
   * resultado chega ao servidor por callback. O browser não é notificado, por
   * isso perguntamos de 3 em 3 segundos até haver desfecho — e paramos sempre
   * ao desmontar, para não deixar um intervalo a correr depois de sair da página.
   */
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase !== "pending" || !payment) return;

    pollRef.current = setInterval(() => {
      void (async () => {
        try {
          const { payment: current } = await paymentsApi.status(payment.reference);
          setPayment(current);

          if (current.status === "PAGO") {
            setPhase("paid");
            await refresh();
          } else if (current.status === "FALHADO" || current.status === "CANCELADO") {
            setPhase("failed");
          }
        } catch (error) {
          console.error("Falha ao consultar o pagamento", error);
        }
      })();
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [phase, payment, refresh]);

  const applyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) return;
    setCouponError(null);
    try {
      const result = await ordersApi.previewCoupon(code);
      setCoupon({ code: result.code, discount: result.discount });
      toast.success(`Cupão ${result.code} aplicado`, {
        description: `Desconto de ${formatKz(result.discount)}.`,
      });
    } catch (error) {
      setCoupon(null);
      setCouponError(error instanceof ApiError ? error.message : "Cupão inválido.");
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    const form = new FormData(event.currentTarget);
    const input = {
      customerName: String(form.get("nome") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      phone: String(form.get("telefone") ?? "").trim(),
      province,
      municipality,
      street: String(form.get("morada") ?? "").trim(),
      notes: String(form.get("obs") ?? "").trim() || undefined,
      ...(coupon ? { couponCode: coupon.code } : {}),
      saveAddress: Boolean(user),
    };

    setPhase("submitting");

    try {
      const result = await ordersApi.checkout(input);
      setOrder(result.order);
      setPayment(result.payment);
      setPhase("pending");

      // Alguns provedores usam página alojada; se houver redirect, seguimo-lo.
      if (result.payment.redirectUrl) {
        window.location.href = result.payment.redirectUrl;
      }
    } catch (error) {
      setPhase("idle");
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
      } else {
        toast.error("Não foi possível concluir a encomenda.");
      }
    }
  };

  // Carrinho vazio e sem encomenda em curso: não há checkout a fazer.
  if (!loading && lines.length === 0 && !order) {
    return (
      <div className="shell pb-28 pt-14 md:pt-20">
        <Reveal>
          <p className="eyebrow">Passo final</p>
          <h1 className="mt-5 text-5xl sm:text-6xl xl:text-7xl">Checkout</h1>
        </Reveal>
        <div className="mt-16">
          <EmptyState
            title="Nada para finalizar"
            description="O teu carrinho está vazio. Escolhe as tuas peças antes de avançar."
            action={
              <Link
                to="/shop"
                className="bg-foreground px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-background"
              >
                Ver shop
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  // Pagamento confirmado: o formulário deu lugar à confirmação.
  if (phase === "paid" && order) {
    return (
      <div className="shell pb-28 pt-14 md:pt-20">
        <Reveal className="mx-auto max-w-xl text-center">
          <div className="mx-auto mb-8 grid size-16 place-items-center border border-foreground">
            <CheckCircle2 className="size-7" />
          </div>
          <p className="eyebrow">Pagamento confirmado</p>
          <h1 className="mt-5 text-4xl sm:text-5xl">Encomenda {order.reference}</h1>
          <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
            Recebemos o teu pagamento de {formatKz(order.total)}. Vais receber a confirmação em{" "}
            {order.email} e preparamos o envio para {order.shipping_address.municipality},{" "}
            {order.shipping_address.province}.
          </p>
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <Link
              to="/conta/encomendas"
              className="bg-foreground px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-background transition-colors hover:bg-brand hover:text-brand-foreground"
            >
              Ver encomendas
            </Link>
            <Link
              to="/shop"
              className="border border-border px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors hover:border-foreground"
            >
              Continuar a comprar
            </Link>
          </div>
        </Reveal>
      </div>
    );
  }

  return (
    <div className="shell pb-28 pt-14 md:pt-20">
      <Reveal>
        <p className="eyebrow">Passo final</p>
        <h1 className="mt-5 text-5xl sm:text-6xl xl:text-7xl">Checkout</h1>
      </Reveal>

      <div className="mt-16 grid gap-16 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-24">
        <form className="space-y-12" onSubmit={(e) => void submit(e)}>
          <fieldset className="space-y-6" disabled={phase !== "idle"}>
            <legend className="eyebrow mb-6">Dados de contacto</legend>
            <Field
              id="nome"
              label="Nome completo"
              placeholder="Nome e apelido"
              defaultValue={user ? `${user.firstName} ${user.lastName}` : ""}
              error={errors["customerName"]}
            />
            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                id="telefone"
                label="Telefone"
                placeholder="+244 900 000 000"
                type="tel"
                defaultValue={user?.phone ?? ""}
                error={errors["phone"]}
              />
              <Field
                id="email"
                label="Email"
                placeholder="o.teu@email.com"
                type="email"
                defaultValue={user?.email ?? ""}
                error={errors["email"]}
              />
            </div>
          </fieldset>

          <fieldset className="space-y-6" disabled={phase !== "idle"}>
            <legend className="eyebrow mb-6">Entrega</legend>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.16em]">Província</Label>
                <Select
                  value={province}
                  onValueChange={(value) => {
                    setProvince(value);
                    // O município tem de ser reposto: manter "Lobito" depois de
                    // trocar para Huíla enviaria a encomenda para lado nenhum.
                    setMunicipality("");
                  }}
                >
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
                {errors["province"] && <FieldError>{errors["province"]}</FieldError>}
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.16em]">Município</Label>
                <Select value={municipality} onValueChange={setMunicipality} disabled={!province}>
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
                {errors["municipality"] && <FieldError>{errors["municipality"]}</FieldError>}
              </div>
            </div>
            <Field
              id="morada"
              label="Morada"
              placeholder="Rua, nº, bairro, ponto de referência"
              error={errors["street"]}
            />
            <div className="space-y-2">
              <Label htmlFor="obs" className="text-[11px] uppercase tracking-[0.16em]">
                Observações
              </Label>
              <Textarea
                id="obs"
                name="obs"
                rows={4}
                placeholder="Indicações para a entrega (opcional)"
                className="rounded-none border-border"
              />
            </div>
          </fieldset>

          <fieldset disabled={phase !== "idle"}>
            <legend className="eyebrow mb-6">Cupão</legend>
            <div className="flex gap-3">
              <Input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Código promocional"
                aria-label="Código promocional"
                className="h-12 rounded-none border-border"
              />
              <button
                type="button"
                onClick={() => void applyCoupon()}
                className="shrink-0 border border-border px-6 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors hover:border-foreground"
              >
                Aplicar
              </button>
            </div>
            {couponError && <FieldError>{couponError}</FieldError>}
            {coupon && (
              <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-brand">
                {coupon.code} — desconto de {formatKz(coupon.discount)}
              </p>
            )}
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

            {/* Painel de estado do pagamento — o espaço que o design reservou. */}
            <div
              className={cn(
                "mt-6 border border-dashed border-border p-6 transition-colors",
                phase === "pending" && "border-brand",
                phase === "failed" && "border-destructive",
              )}
              aria-live="polite"
            >
              {phase === "idle" && (
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Espaço reservado — confirmação do pagamento aparecerá aqui
                </p>
              )}

              {(phase === "submitting" || phase === "pending") && (
                <div className="flex items-center gap-4">
                  <Loader2 className="size-5 shrink-0 animate-spin" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {phase === "submitting" ? "A criar a encomenda…" : "A aguardar confirmação…"}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {phase === "submitting"
                        ? "Um instante"
                        : "Confirma o pagamento na app Multicaixa Express"}
                    </p>
                    {payment && phase === "pending" && (
                      <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Ref. {payment.reference}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {phase === "failed" && (
                <div className="flex items-start gap-4">
                  <XCircle className="size-5 shrink-0 text-destructive" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Pagamento não concluído</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {payment?.failureReason ?? "A confirmação não chegou a tempo."}
                    </p>
                    {order && (
                      <button
                        type="button"
                        onClick={() => {
                          void (async () => {
                            try {
                              const { payment: retry } = await paymentsApi.start(order.reference);
                              setPayment(retry);
                              setPhase("pending");
                            } catch {
                              toast.error("Não foi possível reiniciar o pagamento.");
                            }
                          })();
                        }}
                        className="link-underline mt-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
                      >
                        Tentar novamente
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Só fora de produção: simula a confirmação na app do banco enquanto
                as credenciais da EMIS não estão disponíveis. */}
            {phase === "pending" && payment && import.meta.env.DEV && (
              <div className="mt-4 flex flex-wrap gap-3 border border-dashed border-border p-4">
                <p className="w-full text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Simulador (apenas desenvolvimento)
                </p>
                {(["PAGO", "FALHADO"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => void paymentsApi.simulate(payment.reference, status)}
                    className="border border-border px-4 py-2 text-[10px] uppercase tracking-[0.16em] hover:border-foreground"
                  >
                    Simular {status}
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          <button
            type="submit"
            disabled={phase !== "idle" || lines.length === 0}
            className="w-full bg-foreground py-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-brand hover:text-brand-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            Pagar {formatKz(total)}
          </button>
        </form>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="border border-border p-8">
            <h2 className="text-2xl">A tua encomenda</h2>
            <ul className="mt-8 space-y-6">
              {lines.map((l) => (
                <li key={l.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-4">
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
                  <p className="shrink-0 text-[13px]">{formatKz(l.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-8 space-y-4 border-t border-border pt-6 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatKz(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-brand">
                  <dt>Desconto</dt>
                  <dd>−{formatKz(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Envio</dt>
                <dd>{envio === 0 ? "Grátis" : formatKz(envio)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-4 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatKz(total)}</dd>
              </div>
            </dl>

            {lines.some((l) => l.exceedsStock) && (
              <p className="mt-6 inline-flex items-start gap-2 text-[11px] uppercase tracking-[0.14em] text-brand">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Há peças com stock insuficiente. Ajusta o carrinho antes de pagar.
              </p>
            )}

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

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-destructive">{children}</p>;
}

function Field({
  id,
  label,
  placeholder,
  type = "text",
  defaultValue,
  error,
}: {
  id: string;
  label: string;
  placeholder?: string | undefined;
  type?: string | undefined;
  defaultValue?: string | undefined;
  error?: string | undefined;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[11px] uppercase tracking-[0.16em]">
        {label}
      </Label>
      <Input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        aria-invalid={Boolean(error)}
        className={cn("h-12 rounded-none border-border", error && "border-destructive")}
      />
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
