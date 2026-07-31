import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminButton, AdminHeading, DataTable } from "@/components/site/AdminUI";
import { Badge, Spinner } from "@/components/site/Primitives";
import { formatKz } from "@/lib/catalog";
import { ApiError } from "@/lib/api";
import { adminApi, type Coupon } from "@/lib/admin-api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/cupoes")({
  component: AdminCupoes,
});

const STATUS_TONE: Record<Coupon["effectiveStatus"], "dark" | "brand" | "muted"> = {
  ACTIVO: "brand",
  AGENDADO: "dark",
  EXPIRADO: "muted",
  ESGOTADO: "muted",
  INACTIVO: "muted",
};

type FormState = {
  code: string;
  type: "PERCENT" | "FIXED";
  value: string;
  minSubtotal: string;
  maxRedemptions: string;
  endsAt: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  code: "",
  type: "PERCENT",
  value: "10",
  minSubtotal: "",
  maxRedemptions: "",
  endsAt: "",
  active: true,
};

function AdminCupoes() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-cupoes"],
    queryFn: () => adminApi.coupons(),
  });

  const coupons = data?.coupons ?? [];

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setOpen(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditing(coupon);
    setForm({
      code: coupon.code,
      type: coupon.type,
      value: String(coupon.value),
      minSubtotal: coupon.minSubtotal ? String(coupon.minSubtotal) : "",
      maxRedemptions: coupon.maxRedemptions ? String(coupon.maxRedemptions) : "",
      // `<input type="date">` só aceita YYYY-MM-DD.
      endsAt: coupon.endsAt ? coupon.endsAt.slice(0, 10) : "",
      active: coupon.active,
    });
    setErrors({});
    setOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    const payload = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      minSubtotal: form.minSubtotal ? Number(form.minSubtotal) : null,
      maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
      endsAt: form.endsAt ? new Date(`${form.endsAt}T23:59:59`).toISOString() : null,
      active: form.active,
    };

    try {
      if (editing) {
        await adminApi.updateCoupon(editing.id, payload);
        toast.success("Cupão actualizado");
      } else {
        await adminApi.createCoupon(payload);
        toast.success("Cupão criado");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-cupoes"] });
      setOpen(false);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
      } else {
        toast.error("Não foi possível guardar o cupão.");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (coupon: Coupon) => {
    try {
      const result = await adminApi.deleteCoupon(coupon.id);
      await queryClient.invalidateQueries({ queryKey: ["admin-cupoes"] });
      toast.success(result.archived ? (result.message ?? "Cupão desactivado") : "Cupão removido");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Não foi possível remover.");
    }
  };

  return (
    <div className="space-y-10">
      <AdminHeading
        title="Cupões"
        action={<AdminButton onClick={openCreate}>Novo cupão</AdminButton>}
      />

      {isLoading ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner className="size-6" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="border border-border bg-background px-5 py-16 text-center text-sm text-muted-foreground">
          Ainda não há cupões. Cria o primeiro para começar uma campanha.
        </div>
      ) : (
        <DataTable
          columns={["Código", "Desconto", "Mínimo", "Utilizações", "Validade", "Estado", ""]}
          rows={coupons.map((c) => [
            <span className="font-semibold">{c.code}</span>,
            c.type === "PERCENT" ? `${c.value}%` : formatKz(c.value),
            c.minSubtotal ? formatKz(c.minSubtotal) : "—",
            `${c.timesRedeemed}${c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}`,
            <span className="text-muted-foreground">
              {c.endsAt ? new Date(c.endsAt).toLocaleDateString("pt-PT") : "Sem limite"}
            </span>,
            <Badge tone={STATUS_TONE[c.effectiveStatus]}>{c.effectiveStatus}</Badge>,
            <div className="flex gap-4 text-[11px] font-semibold uppercase tracking-[0.16em]">
              <button className="link-underline" onClick={() => openEdit(c)}>
                Editar
              </button>
              <button
                className="link-underline text-muted-foreground"
                onClick={() => void remove(c)}
              >
                Remover
              </button>
            </div>,
          ])}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {editing ? `Editar ${editing.code}` : "Novo cupão"}
            </DialogTitle>
          </DialogHeader>

          <form className="mt-6 space-y-5" onSubmit={(e) => void save(e)}>
            <Field
              id="cp-code"
              label="Código"
              value={form.code}
              placeholder="DROP10"
              onChange={(v) => setForm({ ...form, code: v.toUpperCase() })}
              error={errors["code"]}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.16em]">Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as "PERCENT" | "FIXED" })}
                >
                  <SelectTrigger className="h-12 rounded-none border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="PERCENT">Percentagem</SelectItem>
                    <SelectItem value="FIXED">Valor fixo (Kz)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field
                id="cp-value"
                label={form.type === "PERCENT" ? "Percentagem" : "Valor (Kz)"}
                type="number"
                value={form.value}
                onChange={(v) => setForm({ ...form, value: v })}
                error={errors["value"]}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="cp-min"
                label="Subtotal mínimo (Kz)"
                type="number"
                value={form.minSubtotal}
                placeholder="Sem mínimo"
                onChange={(v) => setForm({ ...form, minSubtotal: v })}
              />
              <Field
                id="cp-max"
                label="Máx. utilizações"
                type="number"
                value={form.maxRedemptions}
                placeholder="Ilimitado"
                onChange={(v) => setForm({ ...form, maxRedemptions: v })}
              />
            </div>

            <Field
              id="cp-ends"
              label="Válido até"
              type="date"
              value={form.endsAt}
              onChange={(v) => setForm({ ...form, endsAt: v })}
              error={errors["endsAt"]}
            />

            <div className="flex items-center justify-between border-t border-border pt-5">
              <p className="text-sm font-semibold">Cupão activo</p>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-3 bg-foreground py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-brand hover:text-brand-foreground disabled:opacity-60"
            >
              {saving && <Spinner className="border-background" />}
              Guardar
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string | undefined;
  placeholder?: string | undefined;
  error?: string | undefined;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[11px] uppercase tracking-[0.16em]">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-12 rounded-none border-border", error && "border-destructive")}
      />
      {error && (
        <p className="text-[11px] uppercase tracking-[0.14em] text-destructive">{error}</p>
      )}
    </div>
  );
}
