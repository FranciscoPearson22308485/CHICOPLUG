import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Reveal } from "@/components/site/Reveal";
import { RequireAuth } from "@/components/site/RequireAuth";
import { useAuth } from "@/context/auth";

export const Route = createFileRoute("/conta")({
  head: () => ({
    meta: [
      { title: "Área do Cliente — CHICOPLUG" },
      {
        name: "description",
        content: "Perfil, encomendas, favoritos e moradas da tua conta CHICOPLUG.",
      },
      { property: "og:title", content: "Área do Cliente — CHICOPLUG" },
      { property: "og:description", content: "Perfil, encomendas, favoritos e moradas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContaLayout,
});

const TABS = [
  { label: "Perfil", to: "/conta" },
  { label: "Encomendas", to: "/conta/encomendas" },
  { label: "Favoritos", to: "/conta/favoritos" },
  { label: "Moradas", to: "/conta/moradas" },
];

function ContaLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success("Sessão terminada");
    void navigate({ to: "/" });
  };

  return (
    <div className="shell pb-28 pt-16 md:pt-24">
      <RequireAuth>
        <Reveal className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6">
          <div className="min-w-0">
            <p className="eyebrow">Área do cliente</p>
            <h1 className="mt-5 text-5xl sm:text-6xl">A tua conta</h1>
            {user && (
              <p className="mt-4 truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {user.firstName} {user.lastName} · {user.email}
              </p>
            )}
          </div>
          <button
            onClick={() => void handleLogout()}
            className="inline-flex shrink-0 items-center gap-2 border border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors hover:border-foreground"
          >
            <LogOut className="size-3.5" />
            Sair
          </button>
        </Reveal>

        <div className="no-scrollbar mt-14 flex gap-8 overflow-x-auto border-b border-border">
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              activeOptions={{ exact: t.to === "/conta" }}
              className="whitespace-nowrap pb-4 text-[11px] font-semibold uppercase tracking-[0.2em]"
              activeProps={{ className: "border-b border-foreground text-foreground" }}
              inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="mt-14">
          <Outlet />
        </div>
      </RequireAuth>
    </div>
  );
}
