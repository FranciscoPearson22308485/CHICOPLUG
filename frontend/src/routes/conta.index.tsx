import { createFileRoute } from "@tanstack/react-router";
import { Reveal } from "@/components/site/Reveal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/conta/")({
  component: Perfil,
});

function Perfil() {
  return (
    <Reveal className="grid gap-16 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-24">
      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="p-nome" label="Nome" value="Chico" />
          <Field id="p-apelido" label="Apelido" value="Plug" />
        </div>
        <Field id="p-email" label="Email" value="cliente@chicoplug.ao" />
        <Field id="p-tel" label="Telefone" value="+244 900 000 000" />
        <div className="flex items-center justify-between border-t border-border pt-6">
          <div>
            <p className="text-sm font-semibold">Notificações de drops</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Avisos por email antes de cada lançamento
            </p>
          </div>
          <Switch defaultChecked />
        </div>
        <button
          type="submit"
          className="bg-foreground px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-brand hover:text-brand-foreground"
        >
          Guardar alterações
        </button>
      </form>

      <aside className="border border-border p-8">
        <p className="eyebrow">Membro desde</p>
        <p className="mt-3 text-2xl">Março 2025</p>
        <dl className="mt-8 space-y-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Encomendas</dt>
            <dd>6</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Favoritos</dt>
            <dd>3</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Nível</dt>
            <dd>Early Access</dd>
          </div>
        </dl>
      </aside>
    </Reveal>
  );
}

function Field({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[11px] uppercase tracking-[0.16em]">
        {label}
      </Label>
      <Input id={id} defaultValue={value} className="h-12 rounded-none border-border" />
    </div>
  );
}