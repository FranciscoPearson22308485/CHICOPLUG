import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { formatKz } from "@/lib/catalog";
import { authApi } from "@/lib/queries";
import { useAuth } from "@/context/auth";
import { Reveal } from "@/components/site/Reveal";
import { Spinner } from "@/components/site/Primitives";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/conta/")({
  component: Perfil,
});

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function Perfil() {
  const { user, setUser } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // O utilizador chega de forma assíncrona; sincronizamos o formulário assim
  // que existe, sem o tornar controlado por um valor que ainda é nulo.
  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setPhone(user.phone ?? "");
    setMarketingOptIn(user.marketingOptIn);
  }, [user]);

  const { data: statsData } = useQuery({
    queryKey: ["conta-stats"],
    queryFn: () => authApi.stats(),
    enabled: Boolean(user),
  });

  const stats = statsData?.stats;

  const memberSince = stats?.memberSince
    ? (() => {
        const date = new Date(stats.memberSince);
        return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
      })()
    : null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const { user: updated } = await authApi.updateProfile({
        firstName,
        lastName,
        phone: phone.trim() || null,
        marketingOptIn,
      });
      setUser(updated);
      toast.success("Perfil actualizado");
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
      } else {
        toast.error("Não foi possível guardar as alterações.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Reveal className="grid gap-16 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-24">
      <form className="space-y-6" onSubmit={(e) => void save(e)}>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            id="p-nome"
            label="Nome"
            value={firstName}
            onChange={setFirstName}
            error={errors["firstName"]}
          />
          <Field
            id="p-apelido"
            label="Apelido"
            value={lastName}
            onChange={setLastName}
            error={errors["lastName"]}
          />
        </div>
        {/* O email identifica a conta: alterá-lo exigiria reverificação, por
            isso fica só de leitura. */}
        <Field id="p-email" label="Email" value={user?.email ?? ""} readOnly />
        <Field
          id="p-tel"
          label="Telefone"
          value={phone}
          onChange={setPhone}
          error={errors["phone"]}
        />
        <div className="flex items-center justify-between border-t border-border pt-6">
          <div>
            <p className="text-sm font-semibold">Notificações de drops</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Avisos por email antes de cada lançamento
            </p>
          </div>
          <Switch checked={marketingOptIn} onCheckedChange={setMarketingOptIn} />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-3 bg-foreground px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-brand hover:text-brand-foreground disabled:opacity-60"
        >
          {saving && <Spinner className="border-background" />}
          Guardar alterações
        </button>
      </form>

      <aside className="border border-border p-8">
        <p className="eyebrow">Membro desde</p>
        <p className="mt-3 text-2xl">{memberSince ?? "—"}</p>
        <dl className="mt-8 space-y-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Encomendas</dt>
            <dd>{stats?.orders ?? 0}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Favoritos</dt>
            <dd>{stats?.wishlist ?? 0}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total gasto</dt>
            <dd>{formatKz(stats?.totalSpent ?? 0)}</dd>
          </div>
        </dl>
      </aside>
    </Reveal>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  readOnly,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange?: ((value: string) => void) | undefined;
  readOnly?: boolean | undefined;
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
        readOnly={readOnly}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-invalid={Boolean(error)}
        className={cn(
          "h-12 rounded-none border-border",
          readOnly && "cursor-not-allowed text-muted-foreground",
          error && "border-destructive",
        )}
      />
      {error && (
        <p className="text-[11px] uppercase tracking-[0.14em] text-destructive">{error}</p>
      )}
    </div>
  );
}
