import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Minus, Plus, Truck, RefreshCcw, Heart } from "lucide-react";
import { toast } from "sonner";
import { PRODUCTS, SIZE_GUIDE, formatKz, getProduct, type Product } from "@/lib/catalog";
import { Reveal } from "@/components/site/Reveal";
import { ProductCard } from "@/components/site/ProductCard";
import { Badge, SectionHeading } from "@/components/site/Primitives";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/produto/$slug")({
  loader: ({ params }): { product: Product } => {
    const product = getProduct(params.slug);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Peça indisponível — CHICOPLUG" }, { name: "robots", content: "noindex" }],
      };
    }
    const { product } = loaderData;
    return {
      meta: [
        { title: `${product.name} — CHICOPLUG` },
        { name: "description", content: product.description },
        { property: "og:title", content: `${product.name} — CHICOPLUG` },
        { property: "og:description", content: product.description },
      ],
    };
  },
  component: ProdutoPage,
});

function ProdutoPage() {
  const { product } = Route.useLoaderData() as { product: Product };
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState(product.colors[0]?.name ?? "");
  const [qty, setQty] = useState(1);
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");

  const soldOut = product.stock === 0;
  const related = PRODUCTS.filter((p) => p.id !== product.id).slice(0, 3);

  const addToCart = () => {
    if (!size) {
      toast("Escolhe um tamanho", { description: "Seleciona o tamanho antes de adicionar." });
      return;
    }
    toast.success("Adicionado ao carrinho", {
      description: `${product.name} · ${color} · ${size} · ${qty}x`,
    });
  };

  return (
    <div className="pb-28">
      <div className="shell pt-8">
        <nav className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-foreground">
            Shop
          </Link>
          <span>/</span>
          <span className="truncate text-foreground">{product.name}</span>
        </nav>
      </div>

      <div className="shell mt-8 grid gap-12 lg:grid-cols-[1.25fr_1fr] lg:gap-20">
        {/* Galeria */}
        <div>
          <div
            className="relative overflow-hidden bg-surface"
            onMouseEnter={() => setZoom(true)}
            onMouseLeave={() => setZoom(false)}
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setOrigin(
                `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`,
              );
            }}
          >
            <img
              src={product.images[active]}
              alt={product.name}
              width={1000}
              height={1250}
              className={cn(
                "aspect-[4/5] w-full object-cover transition-transform duration-700 ease-out",
                zoom && "scale-[1.9]",
              )}
              style={{ transformOrigin: origin }}
            />
            {product.badge && (
              <div className="absolute left-4 top-4">
                <Badge tone={soldOut ? "muted" : "brand"}>{product.badge}</Badge>
              </div>
            )}
            <p className="absolute bottom-4 right-4 hidden text-[10px] uppercase tracking-[0.2em] text-muted-foreground lg:block">
              Passa o rato para ampliar
            </p>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-3 md:gap-4">
            {product.images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={cn(
                  "overflow-hidden bg-surface transition-opacity",
                  active === i ? "ring-1 ring-foreground" : "opacity-60 hover:opacity-100",
                )}
              >
                <img src={img} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow">{product.category}</p>
          <h1 className="mt-4 text-4xl normal-case tracking-tight sm:text-5xl">{product.name}</h1>
          <div className="mt-5 flex items-baseline gap-4">
            <p className="text-xl font-semibold">{formatKz(product.price)}</p>
            {product.compareAt && (
              <p className="text-sm text-muted-foreground line-through">
                {formatKz(product.compareAt)}
              </p>
            )}
          </div>

          <p className="mt-8 max-w-md text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </p>

          {/* Cor */}
          <div className="mt-10">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Cor</p>
              <p className="text-[11px] text-muted-foreground">{color}</p>
            </div>
            <div className="mt-4 flex gap-3">
              {product.colors.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setColor(c.name)}
                  aria-label={c.name}
                  className={cn(
                    "size-8 border transition-transform duration-300 hover:scale-110",
                    color === c.name
                      ? "border-foreground ring-1 ring-foreground ring-offset-2"
                      : "border-border",
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Tamanho */}
          <div className="mt-10">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Tamanho</p>
              <Dialog>
                <DialogTrigger className="link-underline text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Tabela de tamanhos
                </DialogTrigger>
                <DialogContent className="rounded-none sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-2xl">Tabela de tamanhos</DialogTitle>
                  </DialogHeader>
                  <table className="mt-4 w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        <th className="py-3">Tam.</th>
                        <th className="py-3">Peito</th>
                        <th className="py-3">Comp.</th>
                        <th className="py-3">Ombro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SIZE_GUIDE.map((r) => (
                        <tr key={r.size} className="border-b border-border/60">
                          <td className="py-3 font-semibold">{r.size}</td>
                          <td className="py-3 text-muted-foreground">{r.chest}</td>
                          <td className="py-3 text-muted-foreground">{r.length}</td>
                          <td className="py-3 text-muted-foreground">{r.shoulder}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DialogContent>
              </Dialog>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={cn(
                    "border py-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors duration-300",
                    size === s
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Quantidade + stock */}
          <div className="mt-10 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
            <div className="flex shrink-0 items-center border border-border">
              <button
                aria-label="Diminuir"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="grid size-12 place-items-center hover:bg-muted"
              >
                <Minus className="size-4" />
              </button>
              <span className="w-10 text-center text-sm font-semibold">{qty}</span>
              <button
                aria-label="Aumentar"
                onClick={() => setQty((q) => Math.min(product.stock || 1, q + 1))}
                className="grid size-12 place-items-center hover:bg-muted"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <p className="min-w-0 truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {soldOut ? "Sem stock" : `${product.stock} em stock`}
            </p>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              disabled={soldOut}
              onClick={addToCart}
              className="flex-1 bg-foreground py-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-background transition-colors hover:bg-brand hover:text-brand-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              {soldOut ? "Esgotado" : "Adicionar ao carrinho"}
            </button>
            <button
              aria-label="Favoritos"
              className="grid size-[60px] place-items-center border border-border transition-colors hover:border-foreground"
            >
              <Heart className="size-5" />
            </button>
          </div>

          <div className="mt-8 space-y-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <p className="flex items-center gap-3">
              <Truck className="size-4" /> Entrega 24–72h em Luanda
            </p>
            <p className="flex items-center gap-3">
              <RefreshCcw className="size-4" /> Trocas em 7 dias
            </p>
          </div>

          <Accordion type="single" collapsible className="mt-12">
            <AccordionItem value="detalhes">
              <AccordionTrigger className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                Detalhes
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {product.details.map((d) => (
                    <li key={d}>— {d}</li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="envio">
              <AccordionTrigger className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                Envio e devoluções
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                Envios para todas as províncias. Trocas gratuitas em Luanda até 7 dias após a entrega.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      <section className="shell mt-28 md:mt-40">
        <Reveal>
          <SectionHeading eyebrow="Combina com" title="Produtos relacionados" />
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-8">
          {related.map((p, i) => (
            <Reveal key={p.id} delay={i * 80}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}