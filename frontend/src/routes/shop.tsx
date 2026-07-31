import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SlidersHorizontal, X } from "lucide-react";
import { CATEGORIES, COLORS, PRODUCTS, SIZES, formatKz } from "@/lib/catalog";
import { ProductCard } from "@/components/site/ProductCard";
import { Reveal } from "@/components/site/Reveal";
import { EmptyState } from "@/components/site/Primitives";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — CHICOPLUG Streetwear" },
      {
        name: "description",
        content: "Todas as peças CHICOPLUG: hoodies, t-shirts, calças, outerwear, denim e acessórios.",
      },
      { property: "og:title", content: "Shop — CHICOPLUG" },
      { property: "og:description", content: "Hoodies, tees, calças, outerwear e acessórios." },
    ],
  }),
  component: Shop,
});

const SORTS = [
  { id: "novidades", label: "Novidades" },
  { id: "preco-asc", label: "Preço ↑" },
  { id: "preco-desc", label: "Preço ↓" },
  { id: "nome", label: "A–Z" },
] as const;

function Shop() {
  const [cats, setCats] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [max, setMax] = useState(150000);
  const [sort, setSort] = useState<string>("novidades");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const results = useMemo(() => {
    const filtered = PRODUCTS.filter(
      (p) =>
        (cats.length === 0 || cats.includes(p.category)) &&
        (sizes.length === 0 || p.sizes.some((s) => sizes.includes(s))) &&
        (colors.length === 0 || p.colors.some((c) => colors.includes(c.name))) &&
        p.price <= max,
    );
    const sorted = [...filtered];
    if (sort === "preco-asc") sorted.sort((a, b) => a.price - b.price);
    if (sort === "preco-desc") sorted.sort((a, b) => b.price - a.price);
    if (sort === "nome") sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "novidades") sorted.sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew));
    return sorted;
  }, [cats, sizes, colors, max, sort]);

  const activeCount = cats.length + sizes.length + colors.length + (max < 150000 ? 1 : 0);

  const clearAll = () => {
    setCats([]);
    setSizes([]);
    setColors([]);
    setMax(150000);
  };

  const filterPanel = (
    <div className="space-y-10">
      <FilterGroup title="Categoria">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip key={c} active={cats.includes(c)} onClick={() => toggle(cats, setCats, c)}>
              {c}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Tamanho">
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <Chip key={s} active={sizes.includes(s)} onClick={() => toggle(sizes, setSizes, s)}>
              {s}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Cor">
        <div className="flex flex-wrap gap-3">
          {COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => toggle(colors, setColors, c.name)}
              aria-label={c.name}
              aria-pressed={colors.includes(c.name)}
              className={cn(
                "size-7 border transition-transform duration-300 hover:scale-110",
                colors.includes(c.name) ? "border-foreground ring-1 ring-foreground ring-offset-2" : "border-border",
              )}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title={`Preço até ${formatKz(max)}`}>
        <Slider
          value={[max]}
          onValueChange={([v]) => setMax(v ?? 150000)}
          min={20000}
          max={150000}
          step={2000}
        />
      </FilterGroup>

      {activeCount > 0 && (
        <button
          onClick={clearAll}
          className="link-underline text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          Limpar filtros ({activeCount})
        </button>
      )}
    </div>
  );

  return (
    <div className="pb-28 pt-14 md:pt-20">
      <div className="shell">
        <Reveal>
          <p className="eyebrow">Todas as peças</p>
          <h1 className="mt-5 text-6xl sm:text-7xl xl:text-8xl">Shop</h1>
        </Reveal>

        <div className="mt-14 grid gap-3 border-y border-border py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className="inline-flex shrink-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] lg:hidden"
            >
              {filtersOpen ? <X className="size-4" /> : <SlidersHorizontal className="size-4" />}
              Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
            </button>
            <p className="truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {results.length} peças
            </p>
          </div>
          <div className="no-scrollbar -mx-1 flex items-center gap-5 overflow-x-auto px-1 sm:mx-0 sm:shrink-0 sm:px-0">
            {SORTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                className={cn(
                  "whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors",
                  sort === s.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {filtersOpen && <div className="border-b border-border py-8 lg:hidden">{filterPanel}</div>}

        <div className="mt-12 grid gap-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
          <aside className="hidden lg:block">
            <div className="sticky top-28">{filterPanel}</div>
          </aside>

          <div>
            {results.length === 0 ? (
              <EmptyState
                title="Nada encontrado"
                description="Nenhuma peça corresponde a estes filtros. Ajusta a seleção e tenta de novo."
                action={
                  <button
                    onClick={clearAll}
                    className="bg-foreground px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-background"
                  >
                    Limpar filtros
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-14 md:grid-cols-3 md:gap-x-8">
                {results.map((p, i) => (
                  <Reveal key={p.id} delay={i * 60}>
                    <ProductCard product={p} priority={i < 2} />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-4">{title}</p>
      {children}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "border px-3 py-2 text-[11px] uppercase tracking-[0.16em] transition-colors duration-300",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}