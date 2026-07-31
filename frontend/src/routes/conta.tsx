import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Reveal } from "@/components/site/Reveal";

export const Route = createFileRoute("/conta")({
  head: () => ({
    meta: [
      { title: "Área do Cliente — CHICOPLUG" },
      { name: "description", content: "Perfil, encomendas, favoritos e moradas da tua conta CHICOPLUG." },
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
  return (
    <div className="shell pb-28 pt-16 md:pt-24">
      <Reveal>
        <p className="eyebrow">Área do cliente</p>
        <h1 className="mt-5 text-5xl sm:text-6xl">A tua conta</h1>
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
    </div>
  );
}