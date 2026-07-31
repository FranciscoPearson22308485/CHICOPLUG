import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { authApi } from "@/lib/queries";
import { AuthField, AuthLink, AuthShell } from "@/components/site/AuthShell";
import { Spinner } from "@/components/site/Primitives";

export const Route = createFileRoute("/recuperar-password")({
  head: () => ({
    meta: [
      { title: "Recuperar password — CHICOPLUG" },
      { name: "description", content: "Repõe o acesso à tua conta CHICOPLUG." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RecuperarPassword,
});

function RecuperarPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await authApi.forgotPassword(email);
      setSent(true);
      // Em desenvolvimento o backend devolve o token para permitir testar o
      // fluxo completo sem provedor de email configurado.
      if (result.devToken) setDevLink(`/repor-password?token=${result.devToken}`);
    } catch {
      // A resposta é sempre a mesma, exista ou não a conta: confirmar que um
      // email está registado transformaria isto num verificador de contas.
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        eyebrow="Recuperação"
        title="Verifica o email"
        intro="Se existir uma conta associada a este email, enviámos as instruções para repor a password. O link é válido durante uma hora."
        footer={
          <p>
            Já reposta? <AuthLink to="/entrar">Entrar</AuthLink>
          </p>
        }
      >
        <div className="flex items-start gap-4 border border-border p-6">
          <MailCheck className="size-5 shrink-0" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Enviado para <span className="text-foreground">{email}</span>. Verifica também a pasta
            de spam.
          </p>
        </div>

        {devLink && (
          <div className="mt-6 border border-dashed border-border p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Apenas em desenvolvimento — o envio de email ainda não está configurado
            </p>
            <a href={devLink} className="link-underline mt-3 block break-all text-[11px]">
              {devLink}
            </a>
          </div>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Recuperação"
      title="Repor password"
      intro="Indica o email da tua conta e enviamos-te um link para definires uma nova password."
      footer={
        <p>
          Lembraste-te? <AuthLink to="/entrar">Voltar ao login</AuthLink>
        </p>
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
        />
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-3 bg-foreground py-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-brand hover:text-brand-foreground disabled:opacity-60"
        >
          {submitting && <Spinner className="border-background" />}
          Enviar instruções
        </button>
      </form>
    </AuthShell>
  );
}
