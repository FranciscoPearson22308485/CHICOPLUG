import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AdminButton, AdminHeading } from "@/components/site/AdminUI";
import { Spinner } from "@/components/site/Primitives";
import { ApiError } from "@/lib/api";
import { adminApi, type StoreSettings } from "@/lib/admin-api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/configuracoes")({
  component: AdminConfig,
});

const TOGGLES: Array<{ key: keyof StoreSettings; title: string; description: string }> = [
  {
    key: "storeActive",
    title: "Loja ativa",
    description: "Desliga para fechar temporariamente a loja ao público",
  },
  {
    key: "multicaixaEnabled",
    title: "Multicaixa Express",
    description: "Aceitar pagamentos por Multicaixa Express",
  },
  {
    key: "freeShippingEnabled",
    title: "Envio grátis acima do limiar",
    description: "Aplicar automaticamente no checkout",
  },
  {
    key: "dropWaitlistEnabled",
    title: "Newsletter",
    description: "Permitir inscrições na lista de novidades",
  },
];

function AdminConfig() {
  const [form, setForm] = useState<StoreSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => adminApi.settings(),
  });

  useEffect(() => {
    if (data?.settings) setForm(data.settings);
  }, [data]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await adminApi.updateSettings(form);
      await refetch();
      toast.success("Configurações guardadas");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !form) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  const integrations = data?.integrations;

  return (
    <div className="space-y-10">
      <AdminHeading
        title="Configurações"
        action={
          <AdminButton onClick={() => void save()} disabled={saving}>
            {saving ? "A guardar…" : "Guardar"}
          </AdminButton>
        }
      />

      {/* Estado real das integrações — diz exactamente o que falta configurar
          em vez de deixar descobrir na primeira venda que falha. */}
      <div className="grid gap-4 xl:grid-cols-2">
        <IntegrationCard
          title="Pagamentos"
          provider={integrations?.payments.provider ?? "—"}
          configured={integrations?.payments.configured ?? false}
          missing={integrations?.payments.missing ?? []}
          fallbackNote="A correr com o simulador local. As encomendas e os estados de pagamento funcionam ponta a ponta, mas nenhum dinheiro é movimentado."
        />
        <IntegrationCard
          title="Armazenamento de imagens"
          provider={integrations?.storage.provider ?? "—"}
          configured={integrations?.storage.configured ?? false}
          missing={integrations?.storage.missing ?? []}
          fallbackNote="As imagens são optimizadas e guardadas no disco do servidor. Funciona, mas não sobrevive a um redeploy em contentor."
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-6 border border-border bg-background p-6">
          <p className="eyebrow">Loja</p>
          <SettingField
            id="s-nome"
            label="Nome"
            value={form.storeName}
            onChange={(v) => setForm({ ...form, storeName: v })}
          />
          <SettingField
            id="s-email"
            label="Email de contacto"
            value={form.contactEmail}
            onChange={(v) => setForm({ ...form, contactEmail: v })}
          />
          <SettingField
            id="s-envio"
            label="Custo de envio (Kz)"
            type="number"
            value={String(form.shippingFlatRate)}
            onChange={(v) => setForm({ ...form, shippingFlatRate: Number(v) })}
          />
          <SettingField
            id="s-limiar"
            label="Envio grátis a partir de (Kz)"
            type="number"
            value={String(form.freeShippingThreshold)}
            onChange={(v) => setForm({ ...form, freeShippingThreshold: Number(v) })}
          />
        </div>

        <div className="border border-border bg-background p-6">
          <p className="eyebrow mb-6">Preferências</p>
          <div className="divide-y divide-border">
            {TOGGLES.map((toggle) => (
              <div
                key={toggle.key}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{toggle.title}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {toggle.description}
                  </p>
                </div>
                <Switch
                  checked={Boolean(form[toggle.key])}
                  onCheckedChange={(v) => setForm({ ...form, [toggle.key]: v })}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function IntegrationCard({
  title,
  provider,
  configured,
  missing,
  fallbackNote,
}: {
  title: string;
  provider: string;
  configured: boolean;
  missing: string[];
  fallbackNote: string;
}) {
  return (
    <div className="border border-border bg-background p-6">
      <div className="flex items-start gap-4">
        {configured ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand" />
        ) : (
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Provedor actual: {provider} · {configured ? "configurado" : "por configurar"}
          </p>
          {!configured && (
            <>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{fallbackNote}</p>
              {missing.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Variáveis em falta
                  </p>
                  <ul className="mt-2 space-y-1">
                    {missing.map((key) => (
                      <li key={key} className="font-mono text-[11px]">
                        {key}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingField({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string | undefined;
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
        onChange={(e) => onChange(e.target.value)}
        className="h-12 rounded-none border-border"
      />
    </div>
  );
}
