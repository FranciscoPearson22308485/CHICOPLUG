import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Reveal } from "@/components/site/Reveal";
import { cn } from "@/lib/utils";

/**
 * Moldura partilhada pelos ecrãs de autenticação.
 *
 * Estas páginas não existiam no protótipo. Em vez de inventar um estilo novo,
 * reutilizamos exactamente os mesmos elementos do resto do site — `shell`,
 * `eyebrow`, a escala tipográfica das outras páginas, os campos de 48px sem
 * cantos arredondados e o botão preto que passa a laranja no hover.
 */
export function AuthShell({
  eyebrow,
  title,
  intro,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  intro?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
}) {
  return (
    <div className="shell pb-28 pt-16 md:pt-24">
      <Reveal className="mx-auto w-full max-w-md">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-5 text-5xl sm:text-6xl">{title}</h1>
        {intro && <p className="mt-6 text-sm leading-relaxed text-muted-foreground">{intro}</p>}

        <div className="mt-12">{children}</div>

        {footer && (
          <div className="mt-10 border-t border-border pt-6 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {footer}
          </div>
        )}
      </Reveal>
    </div>
  );
}

export function AuthField({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  autoComplete,
  required,
}: {
  id: string;
  label: string;
  type?: string | undefined;
  placeholder?: string | undefined;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  autoComplete?: string | undefined;
  required?: boolean | undefined;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[11px] uppercase tracking-[0.16em]">
        {label}
      </Label>
      <Input
        id={id}
        name={id}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-erro` : undefined}
        className={cn("h-12 rounded-none border-border", error && "border-destructive")}
      />
      {error && (
        <p id={`${id}-erro`} className="text-[11px] uppercase tracking-[0.14em] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="link-underline font-semibold text-foreground">
      {children}
    </Link>
  );
}
