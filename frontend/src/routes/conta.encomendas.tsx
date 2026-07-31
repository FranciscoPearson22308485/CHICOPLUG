import { createFileRoute } from "@tanstack/react-router";
import { Reveal } from "@/components/site/Reveal";
import { Badge } from "@/components/site/Primitives";
import { formatKz } from "@/lib/catalog";

export const Route = createFileRoute("/conta/encomendas")({
  component: Encomendas,
});

const ORDERS = [
  { id: "CP-2041", date: "18 Jan 2026", total: 110000, status: "Entregue", items: 2 },
  { id: "CP-1987", date: "02 Jan 2026", total: 78000, status: "Em trânsito", items: 1 },
  { id: "CP-1902", date: "12 Dez 2025", total: 142000, status: "Entregue", items: 1 },
  { id: "CP-1855", date: "28 Nov 2025", total: 32000, status: "Cancelada", items: 1 },
];

function Encomendas() {
  return (
    <Reveal className="border-t border-border">
      {ORDERS.map((o) => (
        <div
          key={o.id}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 border-b border-border py-6"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold">{o.id}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {o.date} · {o.items} {o.items === 1 ? "peça" : "peças"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-6">
            <Badge
              tone={o.status === "Entregue" ? "dark" : o.status === "Cancelada" ? "muted" : "brand"}
            >
              {o.status}
            </Badge>
            <p className="text-sm font-semibold">{formatKz(o.total)}</p>
          </div>
        </div>
      ))}
    </Reveal>
  );
}