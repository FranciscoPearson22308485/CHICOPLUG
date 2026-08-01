import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function SectionHeading({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6 border-b border-border pb-6",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
        <h2 className="text-3xl sm:text-4xl xl:text-5xl">{title}</h2>
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = "dark",
  className,
}: {
  children: ReactNode;
  tone?: "dark" | "light" | "brand" | "muted";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
        tone === "dark" && "bg-foreground text-background",
        tone === "light" && "bg-background text-foreground",
        tone === "brand" && "bg-brand text-brand-foreground",
        tone === "muted" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TextLink({
  to,
  children,
  className,
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "link-underline text-[11px] font-semibold uppercase tracking-[0.2em]",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-border px-6 py-24 text-center">
      <div className="mb-6 h-px w-10 bg-brand" />
      <h3 className="text-2xl">{title}</h3>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}

export function ProductSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <Skeleton className="h-3 w-2/3 rounded-none" />
      <Skeleton className="h-3 w-1/3 rounded-none" />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-4 animate-spin rounded-full border border-foreground border-t-transparent",
        className,
      )}
      aria-label="A carregar"
    />
  );
}

export function Marquee({ items }: { items: string[] }) {
  const line = [...items, ...items];
  return (
    <div className="overflow-hidden border-y border-border bg-foreground py-3">
      <div className="flex w-max animate-marquee">
        {line.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-8 whitespace-nowrap px-8 text-[11px] font-semibold uppercase tracking-[0.28em] text-background"
          >
            {item}
            <span className="size-1 bg-brand" />
          </span>
        ))}
      </div>
    </div>
  );
}
