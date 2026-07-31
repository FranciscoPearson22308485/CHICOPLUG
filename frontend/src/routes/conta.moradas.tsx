import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Reveal } from "@/components/site/Reveal";
import { Badge } from "@/components/site/Primitives";

export const Route = createFileRoute("/conta/moradas")({
  component: Moradas,
});

const ADDRESSES = [
  {
    label: "Casa",
    lines: ["Rua Amílcar Cabral, 42", "Talatona, Luanda", "+244 900 000 000"],
    main: true,
  },
  {
    label: "Trabalho",
    lines: ["Av. 4 de Fevereiro, 118", "Ingombota, Luanda", "+244 900 111 222"],
    main: false,
  },
];

function Moradas() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {ADDRESSES.map((a, i) => (
        <Reveal key={a.label} delay={i * 80}>
          <div className="flex h-full flex-col border border-border p-6">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <p className="truncate text-sm font-semibold">{a.label}</p>
              {a.main && <Badge tone="brand">Principal</Badge>}
            </div>
            <div className="mt-5 space-y-1 text-sm text-muted-foreground">
              {a.lines.map((l) => (
                <p key={l}>{l}</p>
              ))}
            </div>
            <div className="mt-8 flex gap-6 text-[11px] font-semibold uppercase tracking-[0.18em]">
              <button className="link-underline">Editar</button>
              <button className="link-underline text-muted-foreground">Remover</button>
            </div>
          </div>
        </Reveal>
      ))}
      <Reveal delay={160}>
        <button className="flex h-full min-h-[220px] w-full flex-col items-center justify-center gap-4 border border-dashed border-border text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">
          <Plus className="size-5" />
          Adicionar morada
        </button>
      </Reveal>
    </div>
  );
}