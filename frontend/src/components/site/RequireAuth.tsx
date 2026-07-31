import { useEffect } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useAuth } from "@/context/auth";
import { EmptyState, Spinner } from "@/components/site/Primitives";

/**
 * Guarda de rota do lado do cliente.
 *
 * A verificação a sério está no backend — qualquer endpoint privado exige o
 * token — mas sem isto um visitante veria a área de cliente a piscar dados
 * vazios antes do 401. Enquanto a sessão está a ser verificada mostramos um
 * estado de espera, e não "não tens acesso": distinguir "ainda não sabemos" de
 * "sabemos que não" é o que evita expulsar quem já tinha sessão iniciada.
 */
export function RequireAuth({
  children,
  adminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean | undefined;
}) {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading || user) return;
    // Guarda o destino para voltar aqui depois do login.
    void navigate({ to: "/entrar", search: { redirect: pathname } as never, replace: true });
  }, [loading, user, navigate, pathname]);

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!user) {
    return (
      <EmptyState
        title="Sessão necessária"
        description="Inicia sessão para aceder a esta área."
        action={
          <Link
            to="/entrar"
            className="bg-foreground px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-background"
          >
            Entrar
          </Link>
        }
      />
    );
  }

  if (adminOnly && !isAdmin) {
    return (
      <EmptyState
        title="Área reservada"
        description="Esta secção é exclusiva de administradores."
        action={
          <Link
            to="/"
            className="bg-foreground px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-background"
          >
            Voltar à loja
          </Link>
        }
      />
    );
  }

  return <>{children}</>;
}
