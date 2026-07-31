import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { wishlistApi } from "@/lib/queries";
import { useAuth } from "./auth";

type WishlistContextValue = {
  /** IDs dos produtos favoritos — barato de consultar a partir de cada card. */
  ids: Set<string>;
  isFavourite: (productId: string) => boolean;
  toggle: (productId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const { user, loading } = useAuth();

  const refresh = useCallback(async () => {
    if (!user) {
      setIds(new Set());
      return;
    }
    try {
      const { productIds } = await wishlistApi.ids();
      setIds(new Set(productIds));
    } catch (error) {
      console.error("Falha ao carregar favoritos", error);
    }
  }, [user]);

  useEffect(() => {
    if (loading) return;
    void refresh();
  }, [loading, refresh]);

  const toggle = useCallback(
    async (productId: string) => {
      if (!user) {
        toast("Inicia sessão para guardar favoritos", {
          description: "Os favoritos ficam associados à tua conta.",
        });
        return;
      }

      // Actualização optimista: o coração responde de imediato e revertemos se
      // o servidor recusar. Num gesto tão frequente, esperar pela rede sente-se.
      const wasFavourite = ids.has(productId);
      setIds((prev) => {
        const next = new Set(prev);
        if (wasFavourite) next.delete(productId);
        else next.add(productId);
        return next;
      });

      try {
        const { added } = await wishlistApi.toggle(productId);
        setIds((prev) => {
          const next = new Set(prev);
          if (added) next.add(productId);
          else next.delete(productId);
          return next;
        });
      } catch {
        setIds((prev) => {
          const next = new Set(prev);
          if (wasFavourite) next.add(productId);
          else next.delete(productId);
          return next;
        });
        toast.error("Não foi possível actualizar os favoritos.");
      }
    },
    [ids, user],
  );

  const value = useMemo<WishlistContextValue>(
    () => ({
      ids,
      isFavourite: (productId: string) => ids.has(productId),
      toggle,
      refresh,
    }),
    [ids, toggle, refresh],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist tem de ser usado dentro de <WishlistProvider>.");
  return context;
}
