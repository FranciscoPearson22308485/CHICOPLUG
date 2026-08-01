import { useState } from "react";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RequireAuth } from "@/components/site/RequireAuth";
import { useAuth } from "@/context/auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — CHICOPLUG" },
      { name: "description", content: "Painel de gestão da loja CHICOPLUG (interface)." },
      { property: "og:title", content: "Admin — CHICOPLUG" },
      { property: "og:description", content: "Painel de gestão da loja." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const ITEMS = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Produtos", to: "/admin/produtos", icon: Package },
  { label: "Encomendas", to: "/admin/encomendas", icon: ShoppingCart },
  { label: "Clientes", to: "/admin/clientes", icon: Users },
  { label: "Marcas", to: "/admin/marcas", icon: Store },
  { label: "Categorias", to: "/admin/categorias", icon: Tags },
  { label: "Stock", to: "/admin/stock", icon: Boxes },
  { label: "Cupões", to: "/admin/cupoes", icon: Ticket },
  { label: "Relatórios", to: "/admin/relatorios", icon: BarChart3 },
  { label: "Configurações", to: "/admin/configuracoes", icon: Settings },
];

function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  // Iniciais do administrador com sessão, no lugar do "CP" fixo do protótipo.
  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()
    : "CP";

  return (
    <div className="flex min-h-screen w-full bg-surface">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-background transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <Link to="/" className="font-display text-lg uppercase tracking-brand">
            CHICO<span className="text-brand">PLUG</span>
          </Link>
          <button className="lg:hidden" aria-label="Fechar" onClick={() => setOpen(false)}>
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact ?? false }}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors"
              activeProps={{ className: "bg-foreground text-background" }}
              inactiveProps={{
                className: "text-muted-foreground hover:bg-muted hover:text-foreground",
              }}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-background px-5 py-4 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button className="lg:hidden" aria-label="Abrir menu" onClick={() => setOpen(true)}>
              <Menu className="size-5" />
            </button>
            <p className="truncate text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Painel de gestão
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <Link to="/" className="link-underline text-[11px] uppercase tracking-[0.18em]">
              Ver loja
            </Link>
            <div
              title={user?.email ?? undefined}
              className="grid size-9 place-items-center bg-foreground text-[11px] font-semibold text-background"
            >
              {initials}
            </div>
          </div>
        </header>

        <div className="min-w-0 flex-1 p-5 lg:p-10">
          {/* A protecção real está no backend; esta guarda evita que a UI do
              painel chegue sequer a pintar-se para quem não é administrador. */}
          <RequireAuth adminOnly>
            <Outlet />
          </RequireAuth>
        </div>
      </div>
    </div>
  );
}
