import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { AuthField, AuthLink, AuthShell } from "@/components/site/AuthShell";
import { Spinner } from "@/components/site/Primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/registo")({
  head: () => ({
    meta: [
      { title: "Criar conta — CHICOPLUG" },
      {
        name: "description",
        content: "Cria a tua conta CHICOPLUG e acompanha as tuas encomendas.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Registo,
});

/** Espelha as regras do backend, para dar resposta antes de submeter. */
function passwordIssues(value: string): string[] {
  const issues: string[] = [];
  if (value.length < 8) issues.push("pelo menos 8 caracteres");
  if (!/[a-zA-Z]/.test(value)) issues.push("uma letra");
  if (!/[0-9]/.test(value)) issues.push("um número");
  return issues;
}

function Registo() {
  const { register, user, loading } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/conta", replace: true });
  }, [loading, user, navigate]);

  const issues = passwordIssues(password);
  const passwordOk = password.length > 0 && issues.length === 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (issues.length > 0) {
      setErrors({ password: `A password precisa de ${issues.join(", ")}.` });
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const created = await register({
        firstName,
        lastName,
        email,
        password,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      toast.success(`Conta criada. Bem-vindo, ${created.firstName}`);
      void navigate({ to: "/conta", replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
      } else {
        toast.error("Não foi possível criar a conta.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Nova conta"
      title="Criar conta"
      intro="Guarda favoritos, acompanha encomendas e sabe das novidades primeiro."
      footer={
        <p>
          Já tens conta? <AuthLink to="/entrar">Entrar</AuthLink>
        </p>
      }
    >
      <form className="space-y-6" onSubmit={(e) => void submit(e)}>
        <div className="grid gap-6 sm:grid-cols-2">
          <AuthField
            id="firstName"
            label="Nome"
            required
            autoComplete="given-name"
            value={firstName}
            onChange={setFirstName}
            error={errors["firstName"]}
          />
          <AuthField
            id="lastName"
            label="Apelido"
            required
            autoComplete="family-name"
            value={lastName}
            onChange={setLastName}
            error={errors["lastName"]}
          />
        </div>

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
          id="phone"
          label="Telefone (opcional)"
          type="tel"
          autoComplete="tel"
          placeholder="+244 900 000 000"
          value={phone}
          onChange={setPhone}
          error={errors["phone"]}
        />

        <div>
          <AuthField
            id="password"
            label="Password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={setPassword}
            error={errors["password"]}
          />
          {/* Requisitos em tempo real: dizer o que falta antes de submeter
              poupa uma ida ao servidor e a frustração de um erro genérico. */}
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

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-3 bg-foreground py-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-brand hover:text-brand-foreground disabled:opacity-60"
        >
          {submitting && <Spinner className="border-background" />}
          Criar conta
        </button>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Ao criar conta aceitas os nossos termos e a política de privacidade.
        </p>
      </form>
    </AuthShell>
  );
}
