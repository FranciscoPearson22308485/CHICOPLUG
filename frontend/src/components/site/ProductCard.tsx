import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { formatKz, type Product } from "@/lib/catalog";
import { Badge } from "@/components/site/Primitives";
import { useWishlist } from "@/context/wishlist";
import { cn } from "@/lib/utils";

export function ProductCard({ product, priority }: { product: Product; priority?: boolean }) {
  const soldOut = product.stock === 0;
  const wishlist = useWishlist();
  const isFavourite = wishlist.isFavourite(product.id);

  return (
    <article className="group relative">
      <Link
        to="/produto/$slug"
        params={{ slug: product.slug }}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative overflow-hidden bg-surface">
          <img
            src={product.images[0]}
            alt={product.name}
            width={1000}
            height={1250}
            loading={priority ? "eager" : "lazy"}
            className="aspect-[4/5] w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
          />
          {product.images[1] && (
            <img
              src={product.images[1]}
              alt=""
              aria-hidden
              width={1000}
              height={1250}
              loading="lazy"
              className="absolute inset-0 aspect-[4/5] w-full object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            />
          )}
          {product.badge && (
            <div className="absolute left-3 top-3">
              <Badge tone={soldOut ? "muted" : product.badge === "DROP" ? "brand" : "dark"}>
                {product.badge}
              </Badge>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 translate-y-3 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 max-md:hidden">
            <span className="block bg-background px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em]">
              {soldOut ? "Esgotado" : "Ver peça"}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold tracking-normal normal-case sm:truncate">
              {product.name}
            </h3>
            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {product.category}
            </p>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-[13px] font-semibold">{formatKz(product.price)}</p>
            {product.compareAt && (
              <p className="text-[11px] text-muted-foreground line-through">
                {formatKz(product.compareAt)}
              </p>
            )}
          </div>
        </div>
      </Link>

      <button
        type="button"
        aria-label={isFavourite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        aria-pressed={isFavourite}
        onClick={() => void wishlist.toggle(product.id)}
        className={cn(
          "absolute right-3 top-3 grid size-9 place-items-center bg-background/85 transition-opacity duration-300 hover:bg-background max-md:opacity-100",
          // Um favorito activo fica sempre visível — esconder o estado no hover
          // faria o cliente perder a noção do que já guardou.
          isFavourite ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <Heart className={cn("size-4 transition-colors", isFavourite && "fill-brand text-brand")} />
      </button>
    </article>
  );
}