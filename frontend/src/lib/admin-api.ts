import { api, apiFetch } from "./api";
import type { Brand, Category, Order, OrderStatus, Product } from "./catalog";

/** Chamadas à área /api/admin. Todas exigem sessão com perfil ADMIN. */

export type Paginated<K extends string, T> = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} & Record<K, T[]>;

export type AdminCustomer = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: "USER" | "ADMIN";
  active: boolean;
  marketingOptIn: boolean;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
};

export type StockVariant = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  sku: string;
  size: string;
  colorName: string;
  colorHex: string;
  stock: number;
  lowStockThreshold: number;
  status: "OK" | "CRITICO" | "SEM_STOCK";
};

export type Coupon = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minSubtotal: number | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  ordersUsing: number;
  effectiveStatus: "ACTIVO" | "INACTIVO" | "AGENDADO" | "EXPIRADO" | "ESGOTADO";
  createdAt: string;
};

export type DashboardData = {
  metrics: {
    revenue30d: number;
    revenueDelta: number | null;
    orders30d: number;
    ordersDelta: number | null;
    ordersToday: number;
    averageTicket: number;
    averageTicketDelta: number | null;
    customerCount: number;
    productCount: number;
  };
  recentOrders: Order[];
  lowStock: Array<{
    variantId: string;
    productId: string;
    productName: string;
    size: string;
    colorName: string;
    stock: number;
  }>;
  statusBreakdown: Array<{ status: OrderStatus; count: number }>;
  monthly: Array<{ month: string; year: number; orders: number; revenue: number }>;
};

export type ReportData = {
  windowDays: number;
  revenue: number;
  discountGiven: number;
  orders: number;
  itemsSold: number;
  cancelledOrders: number;
  cancellationRate: number;
  topProducts: Array<{
    productSlug: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
};

export type StoreSettings = {
  storeName: string;
  contactEmail: string;
  shippingFlatRate: number;
  freeShippingThreshold: number;
  storeActive: boolean;
  multicaixaEnabled: boolean;
  freeShippingEnabled: boolean;
  dropWaitlistEnabled: boolean;
};

export type Integrations = {
  payments: { provider: string; configured: boolean; missing: string[] };
  storage: { provider: string; configured: boolean; missing: string[] };
};

export type VariantInput = {
  id?: string | undefined;
  size: string;
  colorName: string;
  colorHex: string;
  stock: number;
  lowStockThreshold: number;
  priceOverride?: (number | null) | undefined;
  active: boolean;
};

export type ProductInput = {
  name: string;
  description: string;
  details: string[];
  price: number;
  compareAt?: (number | null) | undefined;
  categoryId: string;
  brandId: string;
  badge?: ("NOVO" | "DROP" | "ESGOTADO" | "ULTIMAS_UNIDADES" | null) | undefined;
  isNew: boolean;
  bestSeller: boolean;
  active: boolean;
  metaTitle?: (string | null) | undefined;
  metaDescription?: (string | null) | undefined;
  images: Array<{ url: string; publicId?: (string | null) | undefined; alt?: string | null }>;
  variants: VariantInput[];
};

function query(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const adminApi = {
  dashboard: () => api.get<DashboardData>("/admin/dashboard"),
  reports: (days = 180) => api.get<ReportData>(`/admin/dashboard/reports?days=${days}`),

  products: (
    params: {
      page?: number | undefined;
      pageSize?: number | undefined;
      search?: string | undefined;
    } = {},
  ) => api.get<Paginated<"products", Product>>(`/admin/products${query(params)}`),
  product: (id: string) => api.get<{ product: Product }>(`/admin/products/${id}`),
  createProduct: (input: ProductInput) => api.post<{ product: Product }>("/admin/products", input),
  updateProduct: (id: string, input: Partial<ProductInput>) =>
    api.patch<{ product: Product }>(`/admin/products/${id}`, input),
  deleteProduct: (id: string) =>
    api.delete<{ deleted: boolean; archived: boolean; message?: string }>(`/admin/products/${id}`),

  categories: () => api.get<{ categories: Category[] }>("/admin/categories"),
  createCategory: (input: {
    name: string;
    description?: (string | null) | undefined;
    position?: number;
  }) => api.post<{ category: Category }>("/admin/categories", input),
  updateCategory: (id: string, input: Record<string, unknown>) =>
    api.patch<{ category: Category }>(`/admin/categories/${id}`, input),
  deleteCategory: (id: string) => api.delete<void>(`/admin/categories/${id}`),

  brands: () => api.get<{ brands: Brand[] }>("/admin/brands"),
  createBrand: (input: Record<string, unknown>) =>
    api.post<{ brand: Brand }>("/admin/brands", input),
  updateBrand: (id: string, input: Record<string, unknown>) =>
    api.patch<{ brand: Brand }>(`/admin/brands/${id}`, input),
  deleteBrand: (id: string) =>
    api.delete<{ deleted: boolean; archived: boolean; message?: string }>(`/admin/brands/${id}`),

  newsletter: () =>
    api.get<{
      subscribers: Array<{
        id: string;
        email: string;
        source: string | null;
        active: boolean;
        createdAt: string;
      }>;
      total: number;
      active: number;
    }>("/newsletter"),

  customers: (
    params: {
      page?: number | undefined;
      pageSize?: number | undefined;
      search?: string | undefined;
    } = {},
  ) => api.get<Paginated<"customers", AdminCustomer>>(`/admin/customers${query(params)}`),
  updateCustomer: (id: string, input: Record<string, unknown>) =>
    api.patch<{ customer: AdminCustomer }>(`/admin/customers/${id}`, input),
  deleteCustomer: (id: string) =>
    api.delete<{ deleted: boolean; archived: boolean; message?: string }>(`/admin/customers/${id}`),

  orders: (
    params: {
      page?: number | undefined;
      pageSize?: number | undefined;
      search?: string | undefined;
      status?: string | undefined;
    } = {},
  ) => api.get<Paginated<"orders", Order>>(`/admin/orders${query(params)}`),
  order: (id: string) => api.get<{ order: Order }>(`/admin/orders/${id}`),
  setOrderStatus: (id: string, status: OrderStatus, note?: string) =>
    api.post<{ order: Order }>(`/admin/orders/${id}/status`, { status, note }),

  stock: (
    params: {
      page?: number | undefined;
      pageSize?: number | undefined;
      search?: string | undefined;
      lowOnly?: boolean | undefined;
    } = {},
  ) => api.get<Paginated<"variants", StockVariant>>(`/admin/stock${query(params)}`),
  stockAlerts: () =>
    api.get<{
      alerts: Array<{
        variantId: string;
        productName: string;
        size: string;
        colorName: string;
        stock: number;
        threshold: number;
        severity: "SEM_STOCK" | "CRITICO";
      }>;
      outOfStock: number;
      critical: number;
    }>("/admin/stock/alerts"),
  adjustStock: (
    adjustments: Array<{ variantId: string; quantity: number; mode: "set" | "delta" }>,
  ) =>
    api.post<{
      adjustments: Array<{ variantId: string; sku: string; from: number; to: number }>;
    }>("/admin/stock/adjust", { adjustments }),

  coupons: () => api.get<{ coupons: Coupon[] }>("/admin/coupons"),
  createCoupon: (input: Record<string, unknown>) =>
    api.post<{ coupon: Coupon }>("/admin/coupons", input),
  updateCoupon: (id: string, input: Record<string, unknown>) =>
    api.patch<{ coupon: Coupon }>(`/admin/coupons/${id}`, input),
  deleteCoupon: (id: string) =>
    api.delete<{ deleted: boolean; archived: boolean; message?: string }>(`/admin/coupons/${id}`),

  settings: () =>
    api.get<{ settings: StoreSettings; integrations: Integrations }>("/admin/settings"),
  updateSettings: (input: Partial<StoreSettings>) =>
    api.patch<{ settings: StoreSettings }>("/admin/settings", input),

  /**
   * Upload de imagens. Enviado como `multipart/form-data`, por isso o cliente
   * não define `content-type`: o browser tem de o gerar com o `boundary`.
   */
  uploadImages: (files: File[], folder: "produtos" | "marcas" = "produtos") => {
    const form = new FormData();
    for (const file of files) form.append("files", file);
    return apiFetch<{
      images: Array<{
        url: string;
        publicId: string | null;
        width: number;
        height: number;
        bytes: number;
        format: string;
      }>;
    }>(`/uploads/images?folder=${folder}`, { method: "POST", body: form });
  },

  uploadStatus: () =>
    api.get<{ provider: string; configured: boolean; missing: string[] }>("/uploads/status"),
};

/** Exporta o CSV de encomendas respeitando os cookies de sessão. */
export async function downloadOrdersCsv(): Promise<void> {
  const response = await fetch("/api/admin/orders/export/csv", { credentials: "include" });
  if (!response.ok) throw new Error("Falha ao exportar.");

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "encomendas-chicoplug.csv";
  anchor.click();
  // Sem isto o blob fica retido em memória enquanto a página estiver aberta.
  URL.revokeObjectURL(url);
}
