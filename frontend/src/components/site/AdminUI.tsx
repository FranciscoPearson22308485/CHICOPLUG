import type { ReactNode } from "react";

export function AdminHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <h1 className="min-w-0 truncate text-3xl sm:text-4xl">{title}</h1>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Botão de acção do painel. As classes são exactamente as do protótipo — só
 * acrescentámos as props que faltavam para o tornar funcional (`onClick`,
 * `disabled`, `type`), sem mexer numa única classe de estilo.
 */
export function AdminButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: (() => void) | undefined;
  disabled?: boolean | undefined;
  type?: ("button" | "submit") | undefined;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="bg-foreground px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-background transition-colors hover:bg-brand hover:text-brand-foreground disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: string | undefined;
}) {
  return (
    <div className="border border-border bg-background p-6">
      <p className="eyebrow">{label}</p>
      <p className="mt-4 font-display text-3xl tracking-brand">{value}</p>
      {delta && (
        <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {delta}
        </p>
      )}
    </div>
  );
}

export function DataTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto border border-border bg-background">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th
                key={c}
                className="px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-muted/50">
              {row.map((cell, j) => (
                <td key={j} className="px-5 py-4 align-middle">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
