import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { wishlistApi } from "@/lib/queries";
import { useWishlist } from "@/context/wishlist";
import { ProductCard } from "@/components/site/ProductCard";
import { Reveal } from "@/components/site/Reveal";
import { EmptyState, ProductSkeleton } from "@/components/site/Primitives";

export const Route = createFileRoute("/conta/favoritos")({
  component: Favoritos,
});

function Favoritos() {
  const { ids } = useWishlist();

  // A lista completa é refeita quando o conjunto de IDs muda — tirar um
  // favorito daqui tem de o fazer desaparecer da grelha imediatamente.
  const { data, isLoading } = useQuery({
    queryKey: ["favoritos", [...ids].sort().join(",")],
    queryFn: () => wishlistApi.list(),
  });

  const favs = data?.products ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (favs.length === 0) {
    return (
      <EmptyState
        title="Sem favoritos"
        description="Guarda as peças que te interessam tocando no coração — ficam aqui à tua espera."
        action={
          <Link
            to="/shop"
            className="bg-foreground px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-background"
          >
            Explorar peças
          </Link>
        }
      />
    );
  }

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
