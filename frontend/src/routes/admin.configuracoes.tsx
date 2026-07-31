import { createFileRoute } from "@tanstack/react-router";
import { AdminButton, AdminHeading } from "@/components/site/AdminUI";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/configuracoes")({
  component: AdminConfig,
});

const TOGGLES = [
  ["Loja ativa", "Desliga para colocar a loja em modo drop fechado"],
  ["Multicaixa Express", "Aceitar pagamentos por Multicaixa Express"],
  ["Envio grátis acima de 100.000 Kz", "Aplicar automaticamente no checkout"],
  ["Lista de espera de drops", "Permitir inscrições na newsletter"],
];

function AdminConfig() {
  return (
    <div className="space-y-10">
      <AdminHeading title="Configurações" action={<AdminButton>Guardar</AdminButton>} />

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-6 border border-border bg-background p-6">
          <p className="eyebrow">Loja</p>
          <div className="space-y-2">
            <Label htmlFor="s-nome" className="text-[11px] uppercase tracking-[0.16em]">
              Nome
            </Label>
            <Input id="s-nome" defaultValue="CHICOPLUG" className="h-12 rounded-none border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-email" className="text-[11px] uppercase tracking-[0.16em]">
              Email de contacto
            </Label>
            <Input id="s-email" defaultValue="ola@chicoplug.ao" className="h-12 rounded-none border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-envio" className="text-[11px] uppercase tracking-[0.16em]">
              Custo de envio (Kz)
            </Label>
            <Input id="s-envio" defaultValue="3500" className="h-12 rounded-none border-border" />
          </div>
        </div>

        <div className="border border-border bg-background p-6">
          <p className="eyebrow mb-6">Preferências</p>
          <div className="divide-y divide-border">
            {TOGGLES.map(([title, desc], i) => (
              <div key={title} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {desc}
                  </p>
                </div>
                <Switch defaultChecked={i !== 3} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}