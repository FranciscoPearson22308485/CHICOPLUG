/**
 * Erro de aplicação com código HTTP. Tudo o que for lançado sem ser um
 * `AppError` é tratado como 500 e nunca revela detalhes internos ao cliente.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, "BAD_REQUEST", message, details);

export const unauthorized = (message = "Autenticação necessária.") =>
  new AppError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "Não tens permissão para esta operação.") =>
  new AppError(403, "FORBIDDEN", message);

export const notFound = (message = "Recurso não encontrado.") =>
  new AppError(404, "NOT_FOUND", message);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, "CONFLICT", message, details);

export const unprocessable = (message: string, details?: unknown) =>
  new AppError(422, "UNPROCESSABLE", message, details);

export const tooManyRequests = (message = "Demasiados pedidos. Tenta mais tarde.") =>
  new AppError(429, "TOO_MANY_REQUESTS", message);

export const serviceUnavailable = (message: string, details?: unknown) =>
  new AppError(503, "SERVICE_UNAVAILABLE", message, details);
