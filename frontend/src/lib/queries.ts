import { api } from "./api";
import type {
  Address,
  Cart,
  Category,
  Collection,
  Facets,
  Order,
  Product,
  User,
} from "./catalog";

/** Chamadas tipadas à API, agrupadas por área. */

// ─── Catálogo ─────────────────────────────────────────────────────────────────

export type ProductListParams = {
  search?: string | undefined;
  category?: string[] | undefined;
  collection?: string | undefined;
  size?: string[] | undefined;
  color?: string[] | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  sort?: ("novidades" | "preco-asc" | "preco-desc" | "nome") | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
};

export type ProductListResponse = {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: Facets;
};

function toQueryString(params: ProductListParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    // Arrays vazios não devem aparecer no URL — poluem a cache e o histórico.
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(","));
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const catalogApi = {
  products: (params: ProductListParams = {}, headers?: Record<string, string>) =>
    api.get<ProductListResponse>(`/catalog/products${toQueryString(params)}`, { headers }),

  product: (slug: string, headers?: Record<string, string>) =>
    api.get<{ product: Product }>(`/catalog/products/${slug}`, { headers }),

  related: (slug: string, headers?: Record<string, string>) =>
    api.get<{ products: Product[] }>(`/catalog/products/${slug}/related`, { headers }),

  search: (q: string, limit = 6) =>
    api.get<{ products: Product[] }>(
      `/catalog/products/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),

  categories: (headers?: Record<string, string>) =>
    api.get<{ categories: Category[] }>("/catalog/categories", { headers }),

  collections: (headers?: Record<string, string>) =>
    api.get<{ collections: Collection[] }>("/catalog/collections", { headers }),

  collection: (slug: string, headers?: Record<string, string>) =>
    api.get<{ collection: Collection; products: Product[] }>(`/catalog/collections/${slug}`, {
      headers,
    }),

  home: (headers?: Record<string, string>) =>
    api.get<{
      featured: Product[];
      drops: Product[];
      bestSellers: Product[];
      collections: Collection[];
    }>("/catalog/home", { headers }),

  facets: (headers?: Record<string, string>) =>
    api.get<{ facets: Facets }>("/catalog/facets", { headers }),
};

// ─── Autenticação ─────────────────────────────────────────────────────────────

export const authApi = {
  register: (input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string | undefined;
  }) => api.post<{ user: User }>("/auth/register", input),

  login: (email: string, password: string) =>
    api.post<{ user: User }>("/auth/login", { email, password }),

  logout: () => api.post<void>("/auth/logout"),

  me: () => api.get<{ user: User }>("/auth/me"),

  updateProfile: (input: {
    firstName?: string | undefined;
    lastName?: string | undefined;
    phone?: (string | null) | undefined;
    marketingOptIn?: boolean | undefined;
  }) => api.patch<{ user: User }>("/auth/me", input),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ message: string }>("/auth/me/password", { currentPassword, newPassword }),

  forgotPassword: (email: string) =>
    api.post<{ message: string; devToken?: string }>("/auth/forgot-password", { email }),

  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>("/auth/reset-password", { token, password }),

  stats: () =>
    api.get<{
      stats: { orders: number; wishlist: number; memberSince: string; totalSpent: number };
    }>("/auth/me/stats"),
};

// ─── Carrinho ─────────────────────────────────────────────────────────────────

export const cartApi = {
  get: () => api.get<{ cart: Cart }>("/cart"),
  addItem: (variantId: string, quantity = 1) =>
    api.post<{ cart: Cart }>("/cart/items", { variantId, quantity }),
  updateItem: (itemId: string, quantity: number) =>
    api.patch<{ cart: Cart }>(`/cart/items/${itemId}`, { quantity }),
  removeItem: (itemId: string) => api.delete<{ cart: Cart }>(`/cart/items/${itemId}`),
  clear: () => api.delete<{ cart: Cart }>("/cart"),
  validate: () =>
    api.get<{
      valid: boolean;
      issues: Array<{ itemId: string; productName: string; requested: number; available: number }>;
      cart: Cart;
    }>("/cart/validate"),
};

// ─── Favoritos ────────────────────────────────────────────────────────────────

export const wishlistApi = {
  list: () => api.get<{ products: Product[] }>("/wishlist"),
  ids: () => api.get<{ productIds: string[] }>("/wishlist/ids"),
  toggle: (productId: string) =>
    api.post<{ added: boolean; productId: string }>("/wishlist/toggle", { productId }),
};

// ─── Moradas ──────────────────────────────────────────────────────────────────

export const addressesApi = {
  list: () => api.get<{ addresses: Address[] }>("/addresses"),
  create: (input: Omit<Address, "id">) => api.post<{ address: Address }>("/addresses", input),
  update: (id: string, input: Partial<Omit<Address, "id">>) =>
    api.patch<{ address: Address }>(`/addresses/${id}`, input),
  remove: (id: string) => api.delete<void>(`/addresses/${id}`),
};

// ─── Encomendas e pagamentos ──────────────────────────────────────────────────

export type CheckoutInput = {
  customerName: string;
  email: string;
  phone: string;
  province: string;
  municipality: string;
  street: string;
  notes?: string | undefined;
  couponCode?: string | undefined;
  saveAddress?: boolean | undefined;
};

export type PaymentInfo = {
  id: string;
  reference: string;
  provider: string;
  status: "PENDENTE" | "PAGO" | "CANCELADO" | "FALHADO";
  amount: number;
  currency: string;
  redirectUrl: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  failureReason: string | null;
};

export const ordersApi = {
  checkout: (input: CheckoutInput) =>
    api.post<{ order: Order; payment: PaymentInfo }>("/orders/checkout", input),

  previewCoupon: (code: string) =>
    api.post<{
      code: string;
      type: "PERCENT" | "FIXED";
      value: number;
      discount: number;
      subtotal: number;
      total: number;
    }>("/orders/coupons/preview", { code }),

  list: () => api.get<{ orders: Order[] }>("/orders"),
  get: (reference: string) => api.get<{ order: Order }>(`/orders/${reference}`),
  cancel: (reference: string) => api.post<{ order: Order }>(`/orders/${reference}/cancel`),
  lookup: (reference: string, email: string) =>
    api.post<{ order: Order }>("/orders/lookup", { reference, email }),
};

export const paymentsApi = {
  status: (reference: string) => api.get<{ payment: PaymentInfo }>(`/payments/${reference}`),
  start: (orderReference: string) =>
    api.post<{ payment: PaymentInfo }>(`/payments/orders/${orderReference}/start`),
  cancel: (reference: string) => api.post<{ payment: PaymentInfo }>(`/payments/${reference}/cancel`),
  /** Só disponível fora de produção — simula a confirmação na app do banco. */
  simulate: (reference: string, status: "PAGO" | "CANCELADO" | "FALHADO") =>
    api.post<{ payment: PaymentInfo }>("/payments/simulate", { reference, status }),
  providerStatus: () =>
    api.get<{ provider: string; configured: boolean; missing: string[] }>("/payments/status"),
};
