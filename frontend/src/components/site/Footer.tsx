import { Link } from "@tanstack/react-router";
import { Instagram, ArrowRight } from "lucide-react";

const COLS = [
  {
    title: "Loja",
    links: [
      { label: "Shop", to: "/shop" },
      { label: "Coleções", to: "/colecoes" },
      { label: "Carrinho", to: "/carrinho" },
      { label: "Checkout", to: "/checkout" },
    ],
  },
  {
    title: "Marca",
    links: [
      { label: "Sobre", to: "/sobre" },
      { label: "Contacto", to: "/contacto" },
      { label: "FAQ", to: "/faq" },
      { label: "Área do cliente", to: "/conta" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Política de Trocas", to: "/politica-de-trocas" },
      { label: "Política de Privacidade", to: "/politica-de-privacidade" },
      { label: "Termos", to: "/termos" },
      { label: "Admin", to: "/admin" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-foreground text-background">
      <div className="shell py-20 md:py-28">
        <div className="grid gap-16 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <h2 className="text-4xl sm:text-5xl">
              Entra na
              <br />
              lista dos drops
            </h2>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-background/60">
              Acesso antecipado, restocks e lançamentos limitados. Sem ruído.
            </p>
            <form
              className="mt-10 flex max-w-md items-center border-b border-background/25 pb-3"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="email"
                placeholder="o.teu@email.com"
                aria-label="Email"
                className="w-full bg-transparent text-sm text-background placeholder:text-background/40 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Subscrever"
                className="ml-4 shrink-0 transition-transform duration-300 hover:translate-x-1"
              >
                <ArrowRight className="size-5" />
              </button>
            </form>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {COLS.map((col) => (
              <div key={col.title}>
                <p className="mb-6 text-[10px] font-semibold uppercase tracking-[0.24em] text-background/45">
                  {col.title}
                </p>
                <ul className="space-y-3">
                  {col.links.map((l) => (
                    <li key={l.to}>
                      <Link
                        to={l.to}
                        className="link-underline text-[13px] text-background/85 hover:text-background"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6 border-t border-background/15 pt-8">
          <p className="min-w-0 font-display text-[13vw] leading-[0.8] tracking-brand text-background/10 sm:text-[9vw]">
            CHICOPLUG
          </p>
          <div className="shrink-0 text-right text-[10px] uppercase tracking-[0.2em] text-background/45">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-background/85"
            >
              <Instagram className="size-4" /> @chicoplug
            </a>
            <p className="mt-4">Luanda · Angola</p>
            <p className="mt-1">© {new Date().getFullYear()} CHICOPLUG</p>
          </div>
        </div>
      </div>
    </footer>
  );
}