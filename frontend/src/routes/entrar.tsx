import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { AuthField, AuthLink, AuthShell } from "@/components/site/AuthShell";
import { Spinner } from "@/components/site/Primitives";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — CHICOPLUG" },
      { name: "description", content: "Inicia sessão na tua conta CHICOPLUG." },
      // Páginas de sessão não têm valor de indexação e não devem aparecer na pesquisa.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Entrar,
});

function Entrar() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search }) as { redirect?: string };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const destination = search.redirect ?? "/conta";

  // Quem já tem sessão não tem nada a fazer nesta página.
  useEffect(() => {
    if (!loading && user) void navigate({ to: destination, replace: true });
  }, [loading, user, navigate, destination]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      const logged = await login(email, password);
      toast.success(`Bem-vindo de volta, ${logged.firstName}`);
      // Um administrador entra directamente no painel.
      void navigate({
        to: search.redirect ?? (logged.role === "ADMIN" ? "/admin" : "/conta"),
        replace: true,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
      } else {
        toast.error("Não foi possível iniciar sessão.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Área do cliente"
      title="Entrar"
      intro="Acede às tuas encomendas, favoritos e moradas guardadas."
      footer={
        <div className="space-y-3">
          <p>
            Ainda não tens conta? <AuthLink to="/registo">Criar conta</AuthLink>
          </p>
          <p>
            Esqueceste-te da password?{" "}
            <AuthLink to="/recuperar-password">Recuperar acesso</AuthLink>
          </p>
        </div>
      }
    >
      <form className="space-y-6" onSubmit={(e) => void submit(e)}>
        <AuthField
          id="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="o.teu@email.com"
          value={email}
          onChange={setEmail}
          error={errors["email"]}
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={setPassword}
          error={errors["password"]}
        />

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-3 bg-foreground py-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-brand hover:text-brand-foreground disabled:opacity-60"
        >
          {submitting && <Spinner className="border-background" />}
          Entrar
        </button>
      </form>
    </AuthShell>
  );
}
