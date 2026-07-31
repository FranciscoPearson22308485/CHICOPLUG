import type { RequestHandler } from "express";

/**
 * Limpeza defensiva de entradas de texto.
 *
 * A defesa primária contra XSS é o React, que escapa tudo o que interpola, e o
 * Prisma, cujas consultas parametrizadas impedem injecção de SQL. Isto é a
 * segunda camada: remove marcação HTML e caracteres de controlo antes de os
 * dados chegarem à base — para que uma descrição de produto nunca guarde um
 * `<script>` que um futuro export para PDF ou email viesse a interpretar.
 */

/**
 * Remove caracteres de controlo preservando \t, \n e \r, que sao legitimos em
 * texto livre como as observacoes de entrega. Filtramos por codigo em vez de
 * regex para nao depender de escapes fragilizados por ferramentas de edicao.
 */
function stripControlChars(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    const isControl = code < 32 || code === 127;
    const isAllowedWhitespace = code === 9 || code === 10 || code === 13;
    if (isControl && !isAllowedWhitespace) continue;
    out += char;
  }
  return out;
}

const HTML_TAG = /<\/?[a-z][\s\S]*?>/gi;

function cleanString(value: string): string {
  return stripControlChars(value).replace(HTML_TAG, "").trim();
}

function clean(value: unknown, depth = 0): unknown {
  // Objectos profundamente aninhados são um vector de esgotamento de CPU.
  if (depth > 8) return value;

  if (typeof value === "string") return cleanString(value);
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      // Bloqueia poluição de protótipo via corpo JSON.
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      out[k] = clean(v, depth + 1);
    }
    return out;
  }
  return value;
}

export const sanitizeInput: RequestHandler = (req, _res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = clean(req.body) as typeof req.body;
  }
  if (req.query && typeof req.query === "object") {
    const cleaned = clean({ ...req.query }) as Record<string, unknown>;
    for (const key of Object.keys(req.query)) delete (req.query as Record<string, unknown>)[key];
    Object.assign(req.query, cleaned);
  }
  next();
};
