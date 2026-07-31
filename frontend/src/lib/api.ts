/**
 * Cliente da API CHICOPLUG.
 *
 * No browser usamos caminhos relativos (`/api/...`), que o proxy do Vite em
 * desenvolvimento — e o reverse proxy em produção — encaminham para o Express.
 * Isto mantém tudo na mesma origem, que é o que permite aos cookies de sessão
 * `SameSite=Lax` serem enviados: em cross-origin o browser descartá-los-ia e o
 * login parecia funcionar mas nenhuma página autenticada carregava.
 *
 * No servidor (loaders SSR) não existe origem relativa, por isso usamos o URL
 * interno absoluto.
 */

const isServer = typeof window === "undefined";

function baseUrl(): string {
  if (isServer) {
    return (
      (import.meta.env["VITE_API_INTERNAL_URL"] as string | undefined) ??
      "http://localhost:4000"
    );
  }
  return "";
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Mensagens de validação campo a campo, prontas para mostrar num formulário. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const item of this.details as Array<{ field?: string; message?: string }>) {
      if (item.field && item.message) out[item.field] = item.message;
    }
    return out;
  }
}

/** Lê o cookie CSRF, que o backend emite deliberadamente sem httpOnly. */
function csrfToken(): string | null {
  if (isServer) return null;
  const match = /(?:^|;\s*)cp_csrf=([^;]+)/.exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

// `| undefined` explícito em cada campo: o tsconfig usa
// `exactOptionalPropertyTypes`, que distingue "propriedade ausente" de
// "propriedade presente com valor undefined". Sem isto, passar
// `{ headers: talvezUndefined }` não compila.
export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE" | undefined;
  body?: unknown;
  /** Cabeçalhos a reencaminhar em SSR (cookies do pedido original). */
  headers?: Record<string, string> | undefined;
  signal?: AbortSignal | undefined;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, signal } = options;

  const finalHeaders: Record<string, string> = { ...headers };

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isFormData) finalHeaders["content-type"] = "application/json";

  const token = csrfToken();
  if (token && method !== "GET") finalHeaders["x-csrf-token"] = token;

  const response = await fetch(`${baseUrl()}/api${path}`, {
    method,
    headers: finalHeaders,
    // Sem isto os cookies de sessão não acompanham o pedido.
    credentials: "include",
    ...(body !== undefined
      ? { body: isFormData ? (body as FormData) : JSON.stringify(body) }
      : {}),
    ...(signal ? { signal } : {}),
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: unknown } })
      ?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? "Algo correu mal. Tenta novamente.",
      error?.details,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};
