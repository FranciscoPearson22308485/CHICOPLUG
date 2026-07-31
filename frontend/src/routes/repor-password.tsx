import { useState } from "react";
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/queries";
import { AuthField, AuthLink, AuthShell } from "@/components/site/AuthShell";
import { EmptyState, Spinner } from "@/components/site/Primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/repor-password")({
  head: () => ({
    meta: [
      { title: "Nova password — CHICOPLUG" },
      { name: "description", content: "Define uma nova password para a tua conta CHICOPLUG." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReporPassword,
});

function passwordIssues(value: string): string[] {
  const issues: string[] = [];
  if (value.length < 8) issues.push("pelo menos 8 caracteres");
  if (!/[a-zA-Z]/.test(value)) issues.push("uma letra");
  if (!/[0-9]/.test(value)) issues.push("um número");
  return issues;
}

function ReporPassword() {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search }) as { token?: string };
  const token = search.token ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const issues = passwordIssues(password);
  const passwordOk = password.length > 0 && issues.length === 0;
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (issues.length > 0) {
      setErrors({ password: `A password precisa de ${issues.join(", ")}.` });
      return;
    }
    if (password !== confirm) {
      setErrors({ confirm: "As passwords não coincidem." });
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      await authApi.resetPassword(token, password);
      toast.success("Password actualizada. Já podes iniciar sessão.");
      void navigate({ to: "/entrar", replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
      } else {
        toast.error("Não foi possível repor a password.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Sem token não há nada a fazer — melhor dizê-lo do que mostrar um formulário
  // que só vai falhar na submissão.
  if (!token) {
    return (
      <AuthShell eyebrow="Recuperação" title="Link inválido">
        <EmptyState
          title="Link em falta ou incompleto"
          description="Este link de reposição não é válido. Pede um novo para continuares."
          action={
            <a
              href="/recuperar-password"
              className="bg-foreground px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-background"
            >
              Pedir novo link
            </a>
          }
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Recuperação"
      title="Nova password"
      intro="Define a nova password da tua conta. Todas as sessões abertas vão ser terminadas."
      footer={
        <p>
          Mudaste de ideias? <AuthLink to="/entrar">Voltar ao login</AuthLink>
        </p>
      }
    >
      <form className="space-y-6" onSubmit={(e) => void submit(e)}>
        <div>
          <AuthField
            id="password"
            label="Nova password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={setPassword}
            error={errors["password"]}
          />
          {password.length > 0 && (
            <p
              className={cn(
                "mt-2 text-[11px] uppercase tracking-[0.14em]",
                passwordOk ? "text-brand" : "text-muted-foreground",
              )}
            >
              {passwordOk ? "Password válida" : `Falta: ${issues.join(", ")}`}
            </p>
          )}
        </div>

        <AuthField
          id="confirm"
          label="Confirmar password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirm}
          onChange={setConfirm}
          error={errors["confirm"] ?? (mismatch ? "As passwords não coincidem." : undefined)}
        />

        <button
          type="submit"
          disabled={submitting || !passwordOk || mismatch}
          className="inline-flex w-full items-center justify-center gap-3 bg-foreground py-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-brand hover:text-brand-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Spinner className="border-background" />}
          Guardar nova password
        </button>
      </form>
    </AuthShell>
  );
}
