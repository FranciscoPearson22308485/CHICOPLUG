import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

import { ApiError } from "@/lib/api";
import { newsletterApi } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/site/Primitives";

/**
 * Inscrição na newsletter.
 *
 * Partilhado pelo rodapé e pela secção da homepage — a variante `compact`
 * reproduz exactamente o campo minimalista que o rodapé já tinha, para que o
 * desenho não mude.
 */
export function NewsletterForm({
  source = "footer",
  variant = "default",
}: {
  source?: "footer" | "home" | "checkout";
  variant?: "default" | "compact";
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;

    setState("sending");
    setError(null);

    try {
      await newsletterApi.subscribe(email.trim(), source);
      setState("done");
      setEmail("");
    } catch (err) {
      setState("idle");
      setError(err instanceof ApiError ? err.message : "Não foi possível inscrever-te.");
    }
  };

  if (state === "done") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 border border-border px-4 py-4",
          variant === "compact" ? "text-[11px]" : "text-sm",
        )}
        aria-live="polite"
      >
        <Check className="size-4 shrink-0 text-brand" />
        <span className="uppercase tracking-[0.14em]">Inscrição confirmada</span>
      </div>
    );
  }

  const compact = variant === "compact";

  return (
    <form onSubmit={(e) => void submit(e)} className="w-full">
      <div
        className={cn(
          "flex items-center border-b border-border transition-colors focus-within:border-foreground",
          compact ? "py-3" : "border border-b border-border px-5 py-4",
        )}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="o.teu@email.com"
          aria-label="Email para a newsletter"
          disabled={state === "sending"}
          className={cn(
            "min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:opacity-60",
            compact ? "text-[11px] uppercase tracking-[0.16em]" : "text-sm",
          )}
        />
        <button
          type="submit"
          disabled={state === "sending"}
          aria-label="Subscrever newsletter"
          className="ml-4 shrink-0 transition-transform duration-300 hover:translate-x-1 disabled:opacity-60"
        >
          {state === "sending" ? <Spinner /> : <ArrowRight className="size-4" />}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-destructive">{error}</p>
      )}

      {!compact && (
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Só novidades e lançamentos. Podes sair quando quiseres.
        </p>
      )}
    </form>
  );
}
