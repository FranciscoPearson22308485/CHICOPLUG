import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/catalog";
import { catalogApi } from "@/lib/queries";
import { useCart } from "@/context/cart";
import { useAuth } from "@/context/auth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  { label: "Shop", to: "/shop" },
  { label: "Coleções", to: "/colecoes" },
  { label: "Sobre", to: "/sobre" },
  { label: "Contacto", to: "/contacto" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mega, setMega] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState("");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const { itemCount: count } = useCart();
  const { user } = useAuth();

  // Categorias e colecções reais. `staleTime` alto porque mudam com o catálogo,
  // não com a navegação — não vale a pena refazer o pedido em cada página.
  const { data: taxonomy } = useQuery({
    queryKey: ["navbar-taxonomy"],
    queryFn: async () => {
      const [categories, collections] = await Promise.all([
        catalogApi.categories(),
        catalogApi.collections(),
      ]);
      return { categories: categories.categories, collections: collections.collections };
    },
    staleTime: 5 * 60 * 1000,
  });

  const categories = taxonomy?.categories.map((c) => c.name) ?? [...CATEGORIES];
  const collections = taxonomy?.collections ?? [];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setMega(false);
    setSearchOpen(false);
  }, [pathname]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = term.trim();
    if (!query) return;
    void navigate({ to: "/shop", search: { search: query } as never });
    setSearchOpen(false);
    setTerm("");
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-500",
        scrolled || mega ? "border-border bg-background/92 backdrop-blur-xl" : "border-transparent bg-background",
      )}
      onMouseLeave={() => setMega(false)}
    >
      <div className="shell grid h-16 grid-cols-[auto_1fr_auto] items-center gap-4 md:h-20">
        {/* Mobile menu */}
        <div className="flex items-center gap-2 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger aria-label="Abrir menu" className="grid size-9 place-items-center">
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[86vw] border-r border-border p-0 sm:max-w-sm">
              <div className="flex h-16 items-center justify-between border-b border-border px-5">
                <span className="font-display text-lg tracking-brand">CHICOPLUG</span>
                <button aria-label="Fechar" onClick={() => setOpen(false)}>
                  <X className="size-5" />
                </button>
              </div>
              <nav className="flex flex-col px-5 py-8">
                {NAV.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="border-b border-border py-5 font-display text-3xl uppercase tracking-brand"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="px-5">
                <p className="eyebrow mb-4">Categorias</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <Link
                      key={c}
                      to="/shop"
                      className="border border-border px-3 py-2 text-[11px] uppercase tracking-[0.16em]"
                    >
                      {c}
                    </Link>
                  ))}
                </div>
                <div className="mt-10 flex flex-col gap-3 text-[11px] uppercase tracking-[0.2em]">
                  <Link to={user ? "/conta" : "/entrar"}>
                    {user ? "Área do cliente" : "Entrar / Registar"}
                  </Link>
                  <Link to="/faq">FAQ</Link>
                  <Link to="/admin">Admin</Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop nav left */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onMouseEnter={() => setMega(item.to === "/shop" || item.to === "/colecoes")}
              className="link-underline text-[11px] font-semibold uppercase tracking-[0.2em]"
              activeProps={{ className: "text-foreground" }}
              inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          to="/"
          className="justify-self-center font-display text-xl uppercase leading-none tracking-brand md:text-2xl"
        >
          CHICO<span className="text-brand">PLUG</span>
        </Link>

        <div className="flex items-center gap-1 justify-self-end md:gap-3">
          <button
            aria-label="Pesquisar"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((v) => !v)}
            className="grid size-9 place-items-center"
          >
            {searchOpen ? <X className="size-[18px]" /> : <Search className="size-[18px]" />}
          </button>
          <Link
            to={user ? "/conta" : "/entrar"}
            aria-label={user ? "A minha conta" : "Entrar"}
            className="relative hidden size-9 place-items-center md:grid"
          >
            <User className="size-[18px]" />
            {user && (
              <span className="absolute bottom-1 right-1 size-1.5 rounded-full bg-brand" />
            )}
          </Link>
          <Link to="/carrinho" aria-label="Carrinho" className="relative grid size-9 place-items-center">
            <ShoppingBag className="size-[18px]" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center bg-brand text-[9px] font-bold text-brand-foreground">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Painel de pesquisa */}
      {searchOpen && (
        <div className="border-t border-border">
          <form onSubmit={submitSearch} className="shell flex items-center gap-4 py-5">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Procurar peças, categorias…"
              aria-label="Pesquisar no catálogo"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
            >
              Procurar
            </button>
          </form>
        </div>
      )}

      {/* Mega menu */}
      <div
        className={cn(
          "hidden overflow-hidden border-t border-border transition-[max-height,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:block",
          mega ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="shell grid grid-cols-12 gap-10 py-12">
          <div className="col-span-3">
            <p className="eyebrow mb-6">Categorias</p>
            <ul className="space-y-3">
              {categories.map((c) => (
                <li key={c}>
                  <Link to="/shop" className="link-underline text-sm">
                    {c}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-3">
            <p className="eyebrow mb-6">Coleções</p>
            <ul className="space-y-3">
              {collections.map((c) => (
                <li key={c.slug}>
                  <Link
                    to="/colecoes/$slug"
                    params={{ slug: c.slug }}
                    className="link-underline text-sm"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-6 grid grid-cols-2 gap-6">
            {collections.slice(0, 2).map((c) => (
              <Link
                key={c.slug}
                to="/colecoes/$slug"
                params={{ slug: c.slug }}
                className="group relative overflow-hidden bg-surface"
              >
                <img
                  src={c.image}
                  alt={c.name}
                  loading="lazy"
                  className="aspect-[16/9] w-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
                />
                <span className="absolute bottom-4 left-4 bg-background px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em]">
                  {c.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}