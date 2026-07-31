import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { MUNICIPALITIES, PROVINCES, type Address } from "@/lib/catalog";
import { addressesApi } from "@/lib/queries";
import { Reveal } from "@/components/site/Reveal";
import { Badge, Spinner } from "@/components/site/Primitives";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/conta/moradas")({
  component: Moradas,
});

type FormState = {
  label: string;
  recipientName: string;
  phone: string;
  province: string;
  municipality: string;
  street: string;
  notes: string;
  isDefault: boolean;
};

const EMPTY_FORM: FormState = {
  label: "",
  recipientName: "",
  phone: "",
  province: "",
  municipality: "",
  street: "",
  notes: "",
  isDefault: false,
};

function Moradas() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Address | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["moradas"],
    queryFn: () => addressesApi.list(),
  });

  const addresses = data?.addresses ?? [];

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setOpen(true);
  };

  const openEdit = (address: Address) => {
    setEditing(address);
    setForm({
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      province: address.province,
      municipality: address.municipality,
      street: address.street,
      notes: address.notes ?? "",
      isDefault: address.isDefault,
    });
    setErrors({});
    setOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    const payload = {
      ...form,
      notes: form.notes.trim() || null,
    };

    try {
      if (editing) {
        await addressesApi.update(editing.id, payload);
        toast.success("Morada actualizada");
      } else {
        await addressesApi.create(payload as never);
        toast.success("Morada adicionada");
      }
      await queryClient.invalidateQueries({ queryKey: ["moradas"] });
      setOpen(false);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
      } else {
        toast.error("Não foi possível guardar a morada.");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (address: Address) => {
    try {
      await addressesApi.remove(address.id);
      await queryClient.invalidateQueries({ queryKey: ["moradas"] });
      toast.success("Morada removida");
    } catch {
      toast.error("Não foi possível remover a morada.");
    }
  };

  return (
    <>
      <div className="grid gap-6 md:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full grid min-h-[200px] place-items-center">
            <Spinner className="size-6" />
          </div>
        ) : (
          addresses.map((a, i) => (
            <Reveal key={a.id} delay={i * 80}>
              <div className="flex h-full flex-col border border-border p-6">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                  <p className="truncate text-sm font-semibold">{a.label}</p>
                  {a.isDefault && <Badge tone="brand">Principal</Badge>}
                </div>
                <div className="mt-5 space-y-1 text-sm text-muted-foreground">
                  <p>{a.recipientName}</p>
                  <p>{a.street}</p>
                  <p>
                    {a.municipality}, {a.province}
                  </p>
                  <p>{a.phone}</p>
                </div>
                <div className="mt-8 flex gap-6 text-[11px] font-semibold uppercase tracking-[0.18em]">
                  <button className="link-underline" onClick={() => openEdit(a)}>
                    Editar
                  </button>
                  <button
                    className="link-underline text-muted-foreground"
                    onClick={() => void remove(a)}
                  >
                    Remover
                  </button>
                </div>
              </div>
            </Reveal>
          ))
        )}

        <Reveal delay={160}>
          <button
            onClick={openCreate}
            className="flex h-full min-h-[220px] w-full flex-col items-center justify-center gap-4 border border-dashed border-border text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            <Plus className="size-5" />
            Adicionar morada
          </button>
        </Reveal>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {editing ? "Editar morada" : "Nova morada"}
            </DialogTitle>
          </DialogHeader>

          <form className="mt-6 space-y-5" onSubmit={(e) => void save(e)}>
            <FormField
              id="a-label"
              label="Nome da morada"
              placeholder="Casa, Trabalho…"
              value={form.label}
              onChange={(v) => setForm({ ...form, label: v })}
              error={errors["label"]}
            />
            <FormField
              id="a-dest"
              label="Destinatário"
              value={form.recipientName}
              onChange={(v) => setForm({ ...form, recipientName: v })}
              error={errors["recipientName"]}
            />
            <FormField
              id="a-tel"
              label="Telefone"
              placeholder="+244 900 000 000"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              error={errors["phone"]}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.16em]">Província</Label>
                <Select
                  value={form.province}
                  onValueChange={(v) => setForm({ ...form, province: v, municipality: "" })}
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
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.16em]">Município</Label>
                <Select
                  value={form.municipality}
                  onValueChange={(v) => setForm({ ...form, municipality: v })}
                  disabled={!form.province}
                >
                  <SelectTrigger className="h-12 rounded-none border-border">
                    <SelectValue placeholder={form.province ? "Seleciona" : "Escolhe a província"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {(MUNICIPALITIES[form.province] ?? []).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <FormField
              id="a-morada"
              label="Morada"
              placeholder="Rua, nº, bairro"
              value={form.street}
              onChange={(v) => setForm({ ...form, street: v })}
              error={errors["street"]}
            />

            <div className="space-y-2">
              <Label htmlFor="a-notas" className="text-[11px] uppercase tracking-[0.16em]">
                Observações
              </Label>
              <Textarea
                id="a-notas"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="rounded-none border-border"
              />
            </div>

            <div className="flex items-center justify-between border-t border-border pt-5">
              <p className="text-sm font-semibold">Morada principal</p>
              <Switch
                checked={form.isDefault}
                onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-3 bg-foreground py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-brand hover:text-brand-foreground disabled:opacity-60"
            >
              {saving && <Spinner className="border-background" />}
              {editing ? "Guardar alterações" : "Adicionar morada"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FormField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
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
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        className={cn("h-12 rounded-none border-border", error && "border-destructive")}
      />
      {error && (
        <p className="text-[11px] uppercase tracking-[0.14em] text-destructive">{error}</p>
      )}
    </div>
  );
}
