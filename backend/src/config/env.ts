import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

/**
 * Carrega o `.env` local em desenvolvimento. Em produção as variáveis vêm da
 * plataforma (Railway, Render, Docker…) e não há ficheiro nenhum — daí o
 * carregamento ser silenciosamente opcional. Usamos `loadEnvFile` do próprio
 * Node em vez de acrescentar `dotenv` como dependência.
 */
function loadEnvFile(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  try {
    process.loadEnvFile(envPath);
  } catch {
    // Node < 20.12: parsing manual, suficiente para o formato CHAVE="valor".
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const match = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
      if (!match || line.trimStart().startsWith("#")) continue;
      const key = match[1]!;
      if (process.env[key] !== undefined) continue;
      process.env[key] = (match[2] ?? "").trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvFile();

/**
 * Validação do ambiente no arranque. Falhar aqui — alto e cedo — é
 * preferível a descobrir um segredo em falta no primeiro login em produção.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),

  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET precisa de pelo menos 16 caracteres"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET precisa de pelo menos 16 caracteres"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),
  CLOUDINARY_FOLDER: z.string().default("chicoplug"),

  PAYMENTS_PROVIDER: z.enum(["mock", "multicaixa"]).default("mock"),
  MULTICAIXA_API_URL: z.string().default(""),
  MULTICAIXA_POS_ID: z.string().optional().default(""),
  MULTICAIXA_CALLBACK_URL: z.string().optional().default(""),
  MULTICAIXA_WEBHOOK_SECRET: z.string().optional().default(""),
  MULTICAIXA_CERT_PATH: z.string().optional().default(""),
  MULTICAIXA_CERT_PASSPHRASE: z.string().optional().default(""),

  SHIPPING_FLAT_RATE: z.coerce.number().int().nonnegative().default(3500),
  FREE_SHIPPING_THRESHOLD: z.coerce.number().int().nonnegative().default(100000),

  SEED_ADMIN_EMAIL: z.string().email().default("admin@chicoplug.ao"),
  SEED_ADMIN_PASSWORD: z.string().min(8).default("ChicoPlug!2026"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  · ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Configuração de ambiente inválida:\n${issues}`);
}

const raw = parsed.data;

const isProduction = raw.NODE_ENV === "production";

// Segredos de desenvolvimento nunca podem sobreviver até produção.
if (isProduction) {
  const weak = [raw.JWT_ACCESS_SECRET, raw.JWT_REFRESH_SECRET].some((s) => s.startsWith("dev-"));
  if (weak) {
    throw new Error(
      "Os segredos JWT de desenvolvimento estão activos em produção. " +
        "Gera novos com `openssl rand -base64 48`.",
    );
  }
}

export const env = {
  ...raw,
  isProduction,
  isTest: raw.NODE_ENV === "test",
  isDevelopment: raw.NODE_ENV === "development",

  corsOrigins: raw.CORS_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  /** O Cloudinary só é usado quando as três credenciais estão presentes. */
  cloudinaryEnabled: Boolean(
    raw.CLOUDINARY_CLOUD_NAME && raw.CLOUDINARY_API_KEY && raw.CLOUDINARY_API_SECRET,
  ),

  /**
   * O adaptador real da EMIS precisa de POS ID e URL. Sem eles reportamos o
   * estado como "por configurar" em vez de falhar silenciosamente.
   */
  multicaixaConfigured: Boolean(raw.MULTICAIXA_POS_ID && raw.MULTICAIXA_API_URL),
} as const;

export type Env = typeof env;
