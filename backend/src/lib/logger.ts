import { env } from "../config/env.js";

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = env.isTest ? ORDER.error : env.isProduction ? ORDER.info : ORDER.debug;

function emit(level: Level, message: string, meta?: Record<string, unknown>): void {
  if (ORDER[level] < threshold) return;

  const line = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(meta ?? {}),
  };

  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  // Em produção emitimos JSON por linha (fácil de ingerir); em dev, algo legível.
  sink(env.isProduction ? JSON.stringify(line) : `[${level}] ${message}`, meta ?? "");
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => emit("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => emit("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit("error", message, meta),
};
