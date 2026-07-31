import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import type { Cart } from "@/lib/catalog";
import { cartApi } from "@/lib/queries";
import { useAuth } from "./auth";

type CartContextValue = {
  cart: Cart | null;
  loading: boolean;
  /** Verdadeiro durante uma mutação — usado para desactivar botões. */
  pending: boolean;
  itemCount: number;
  addItem: (variantId: string, quantity?: number) => Promise<boolean>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const { user, loading: authLoading } = useAuth();

  const refresh = useCallback(async () => {
    try {
      const { cart: current } = await cartApi.get();
      setCart(current);
    } catch (error) {
      console.error("Falha ao carregar o carrinho", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Recarrega quando a sessão muda: ao entrar na conta o carrinho anónimo é
  // fundido no do utilizador pelo backend, e o resultado tem de aparecer aqui.
  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, user?.id, refresh]);

  /**
   * Envolve mutações com estado de espera e tradução de erros para toast.
   * Devolve `false` quando falha, para o chamador poder decidir o que fazer.
   */
  const mutate = useCallback(async (action: () => Promise<{ cart: Cart }>): Promise<boolean> => {
    setPending(true);
    try {
      const { cart: updated } = await action();
      setCart(updated);
      return true;
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Não foi possível actualizar o carrinho.";
      toast.error(message);
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  const addItem = useCallback(
    (variantId: string, quantity = 1) => mutate(() => cartApi.addItem(variantId, quantity)),
    [mutate],
  );

  const updateItem = useCallback(
    async (itemId: string, quantity: number) => {
      await mutate(() => cartApi.updateItem(itemId, quantity));
    },
    [mutate],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      await mutate(() => cartApi.removeItem(itemId));
    },
    [mutate],
  );

  const clear = useCallback(async () => {
    await mutate(() => cartApi.clear());
  }, [mutate]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      loading,
      pending,
      itemCount: cart?.itemCount ?? 0,
      addItem,
      updateItem,
      removeItem,
      clear,
      refresh,
    }),
    [cart, loading, pending, addItem, updateItem, removeItem, clear, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart tem de ser usado dentro de <CartProvider>.");
  return context;
}
