import { Link } from "@tanstack/react-router";
import { Instagram } from "lucide-react";

import { NewsletterForm } from "@/components/site/NewsletterForm";

const COLS = [
  {
    title: "Loja",
    links: [
      { label: "Shop", to: "/shop" },
      { label: "Marcas", to: "/marcas" },
      { label: "Carrinho", to: "/carrinho" },
      { label: "Checkout", to: "/checkout" },
    ],
  },
  {
    title: "Loja CHICOPLUG",
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
    <footer className="border-t border-border bg-ink text-ink-foreground">
      <div className="shell py-20 md:py-28">
        <div className="grid gap-16 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <h2 className="text-4xl sm:text-5xl">
              Sabe primeiro
              <br />o que chega
            </h2>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-ink-foreground/60">
              Novidades, reposições e as peças mais procuradas. Sem ruído.
            </p>
            <div className="mt-10 max-w-md">
              <NewsletterForm source="footer" variant="compact" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {COLS.map((col) => (
              <div key={col.title}>
                <p className="mb-6 text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-foreground/45">
                  {col.title}
                </p>
                <ul className="space-y-3">
                  {col.links.map((l) => (
                    <li key={l.to}>
                      <Link
                        to={l.to}
                        className="link-underline text-[13px] text-ink-foreground/85 hover:text-ink-foreground"
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

        <div className="mt-20 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6 border-t border-ink-foreground/15 pt-8">
          <p className="min-w-0 font-display text-[13vw] leading-[0.8] tracking-brand text-ink-foreground/10 sm:text-[9vw]">
            CHICOPLUG
          </p>
          <div className="shrink-0 text-right text-[10px] uppercase tracking-[0.2em] text-ink-foreground/45">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-ink-foreground/85"
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
