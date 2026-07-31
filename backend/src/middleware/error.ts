import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Rota não encontrada: ${req.method} ${req.path}` },
  });
}

/**
 * Único ponto de saída para erros. Traduz erros conhecidos do Prisma e do Zod
 * em respostas úteis, e transforma tudo o resto num 500 opaco — mensagens de
 * erro internas são uma fonte clássica de fuga de informação.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { code: err.code, path: req.path });
    }
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Dados inválidos.",
        details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = (err.meta?.["target"] as string[] | undefined)?.join(", ") ?? "campo";
      res.status(409).json({
        error: { code: "CONFLICT", message: `Já existe um registo com este ${target}.` },
      });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Recurso não encontrado." } });
      return;
    }
    if (err.code === "P2003") {
      res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Não é possível concluir: existem registos dependentes.",
        },
      });
      return;
    }
  }

  const message = err instanceof Error ? err.message : String(err);
  logger.error("Erro não tratado", {
    message,
    path: req.path,
    method: req.method,
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Ocorreu um erro inesperado.",
      // Em produção nunca devolvemos o detalhe interno.
      ...(env.isProduction ? {} : { details: message }),
    },
  });
}
