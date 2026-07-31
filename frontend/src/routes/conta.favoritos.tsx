import { createFileRoute } from "@tanstack/react-router";
import { PRODUCTS } from "@/lib/catalog";
import { ProductCard } from "@/components/site/ProductCard";
import { Reveal } from "@/components/site/Reveal";

export const Route = createFileRoute("/conta/favoritos")({
  component: Favoritos,
});

function Favoritos() {
  const favs = PRODUCTS.slice(0, 3);
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-8">
      {favs.map((p, i) => (
        <Reveal key={p.id} delay={i * 70}>
          <ProductCard product={p} />
        </Reveal>
      ))}
    </div>
  );
}