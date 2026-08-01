import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SlidersHorizontal, X } from "lucide-react";
import { CATEGORIES, COLORS, SIZES, formatKz, type Facets, type Product } from "@/lib/catalog";
import { catalogApi, type ProductListResponse } from "@/lib/queries";
import { ProductCard } from "@/components/site/ProductCard";
import { Reveal } from "@/components/site/Reveal";
import { EmptyState, ProductSkeleton } from "@/components/site/Primitives";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/** Usado só até as facetas reais chegarem, para os filtros não piscarem vazios. */
const FALLBACK_FACETS: Facets = {
  brands: [],
  categories: CATEGORIES.map((name) => ({ name, slug: name.toLowerCase(), count: 0 })),
  sizes: [...SIZES],
  colors: COLORS,
  priceRange: { min: 20000, max: 250000 },
};

const SORTS = [
  { id: "novidades", label: "Novidades" },
  { id: "preco-asc", label: "Preço ↑" },
  { id: "preco-desc", label: "Preço ↓" },
  { id: "marca", label: "Marca" },
  { id: "nome", label: "A–Z" },
] as const;

/**
 * Estado do shop guardado no URL.
 *
 * Manter os filtros no URL — e não em estado local — é o que torna
 * `/shop?marca=nike&categoria=sneakers` partilhável, navegável com o botão
 * "voltar" e renderizável já no servidor.
 */
type ShopSearch = {
  search?: string;
  marca?: string;
  categoria?: string;
};

export const Route = createFileRoute("/shop")({
  validateSearch: (input: Record<string, unknown>): ShopSearch => {
    const str = (key: string): string | undefined => {
      const value = input[key];
      return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : undefined;
    };

    const out: ShopSearch = {};
    const search = str("search");
    const marca = str("marca");
    const categoria = str("categoria");
    if (search) out.search = search;
    if (marca) out.marca = marca;
    if (categoria) out.categoria = categoria;
    return out;
  },

  loaderDeps: ({ search }) => ({
    search: search.search,
    marca: search.marca,
    categoria: search.categoria,
  }),

  loader: async ({ deps }): Promise<ProductListResponse | null> => {
    try {
      return await catalogApi.products({
        ...(deps.search ? { search: deps.search } : {}),
        ...(deps.marca ? { brand: [deps.marca] } : {}),
        ...(deps.categoria ? { category: [deps.categoria] } : {}),
        sort: "novidades",
        pageSize: 24,
      });
    } catch (error) {
      console.error("Falha ao carregar o catálogo", error);
      return null;
    }
  },

  head: () => ({
    meta: [
      { title: "Shop — CHICOPLUG Streetwear Premium" },
      {
        name: "description",
        content:
          "Todas as peças CHICOPLUG: t-shirts, hoodies, jeans, sneakers, calças, casacos, bonés e acessórios das melhores marcas.",
      },
      { property: "og:title", content: "Shop — CHICOPLUG" },
      {
        property: "og:description",
        content: "T-shirts, hoodies, jeans, sneakers e mais, das marcas que definem o streetwear.",
      },
    ],
  }),
  component: Shop,
});

function Shop() {
  const initial = Route.useLoaderData() as ProductListResponse | null;
  const { search: term, marca, categoria } = Route.useSearch();
  const navigate = Route.useNavigate();

  const facets = initial?.facets ?? FALLBACK_FACETS;
  const priceCeiling = facets.priceRange.max || 250000;

  // Os filtros vindos do URL (marca ou categoria) entram já seleccionados.
  const [brands, setBrands] = useState<string[]>(marca ? [marca] : []);
  const [cats, setCats] = useState<string[]>(categoria ? [categoria] : []);
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [max, setMax] = useState(priceCeiling);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [sort, setSort] = useState<string>("novidades");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // O tecto do slider só é conhecido depois da resposta da API.
  useEffect(() => {
    setMax((current) => (current === 250000 ? priceCeiling : current));
  }, [priceCeiling]);

  // Navegar de fora (ex.: card de categoria na homepage) tem de refletir-se
  // nos filtros, sem apagar o que o utilizador já tinha escolhido à mão.
  useEffect(() => {
    if (marca) setBrands([marca]);
  }, [marca]);
  useEffect(() => {
    if (categoria) setCats([categoria]);
  }, [categoria]);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const params = useMemo(
    () => ({
      ...(term ? { search: term } : {}),
      brand: brands,
      category: cats,
      size: sizes,
      color: colors,
      maxPrice: max < priceCeiling ? max : undefined,
      inStock: inStockOnly || undefined,
      onSale: onSaleOnly || undefined,
      sort: sort as "novidades" | "preco-asc" | "preco-desc" | "nome" | "marca",
      pageSize: 24,
    }),
    [term, brands, cats, sizes, colors, max, inStockOnly, onSaleOnly, sort, priceCeiling],
  );

  const { data, isFetching } = useQuery({
    queryKey: ["produtos", params],
    queryFn: () => catalogApi.products(params),
    ...(initial ? { initialData: initial } : {}),
    // Mantém a grelha anterior visível enquanto a nova chega, em vez de
    // colapsar para vazio a cada clique num filtro.
    placeholderData: keepPreviousData,
  });

  const results: Product[] = data?.products ?? [];

  const activeCount =
    brands.length +
    cats.length +
    sizes.length +
    colors.length +
    (max < priceCeiling ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (onSaleOnly ? 1 : 0);

  const clearAll = () => {
    setBrands([]);
    setCats([]);
    setSizes([]);
    setColors([]);
    setMax(priceCeiling);
    setInStockOnly(false);
    setOnSaleOnly(false);
    // Limpa também os filtros que vieram no URL.
    void navigate({ search: (prev: ShopSearch) => (prev.search ? { search: prev.search } : {}) });
  };

  const filterPanel = (
    <div className="space-y-10">
      {facets.brands.length > 0 && (
        <FilterGroup title="Marca">
          <div className="flex flex-wrap gap-2">
            {facets.brands.map((b) => (
              <Chip
                key={b.slug}
                active={brands.includes(b.slug)}
                onClick={() => toggle(brands, setBrands, b.slug)}
              >
                {b.name}
              </Chip>
            ))}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title="Categoria">
        <div className="flex flex-wrap gap-2">
          {facets.categories.map((c) => (
            <Chip
              key={c.slug}
              active={cats.includes(c.slug)}
              onClick={() => toggle(cats, setCats, c.slug)}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Tamanho">
        <div className="flex flex-wrap gap-2">
          {facets.sizes.map((s) => (
            <Chip key={s} active={sizes.includes(s)} onClick={() => toggle(sizes, setSizes, s)}>
              {s}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Cor">
        <div className="flex flex-wrap gap-3">
          {facets.colors.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => toggle(colors, setColors, c.name)}
              aria-label={c.name}
              title={c.name}
              aria-pressed={colors.includes(c.name)}
              className={cn(
                "size-7 border transition-transform duration-300 hover:scale-110",
                colors.includes(c.name)
                  ? "border-foreground ring-1 ring-foreground ring-offset-2 ring-offset-background"
                  : "border-border",
              )}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title={`Preço até ${formatKz(max)}`}>
        <Slider
          value={[max]}
          onValueChange={([v]) => setMax(v ?? priceCeiling)}
          min={facets.priceRange.min}
          max={priceCeiling}
          step={2000}
        />
      </FilterGroup>

      <FilterGroup title="Disponibilidade">
        <div className="flex flex-wrap gap-2">
          <Chip active={inStockOnly} onClick={() => setInStockOnly((v) => !v)}>
            Em stock
          </Chip>
          <Chip active={onSaleOnly} onClick={() => setOnSaleOnly((v) => !v)}>
            Em promoção
          </Chip>
        </div>
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
          <p className="eyebrow">{term ? "Resultados da pesquisa" : "Todas as peças"}</p>
          <h1 className="mt-5 text-6xl sm:text-7xl xl:text-8xl">Shop</h1>
          {term && (
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-3 border border-foreground px-4 py-2 text-[11px] uppercase tracking-[0.16em]">
                {term}
                <button
                  aria-label="Limpar pesquisa"
                  onClick={() => void navigate({ search: {} })}
                  className="transition-opacity hover:opacity-60"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            </div>
          )}
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
              {data?.total ?? results.length} peças
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
            <div className="sticky top-28 max-h-[calc(100svh-9rem)] overflow-y-auto pr-2">
              {filterPanel}
            </div>
          </aside>

          <div>
            {isFetching && results.length === 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-14 md:grid-cols-3 md:gap-x-8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProductSkeleton key={i} />
                ))}
              </div>
            ) : results.length === 0 ? (
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
