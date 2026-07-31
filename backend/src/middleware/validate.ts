import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodTypeAny, type z } from "zod";

import { AppError } from "../lib/errors.js";

type Schemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

function formatIssues(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "(raiz)",
    message: issue.message,
  }));
}

/**
 * Valida e **substitui** body/query/params pela versão analisada pelo Zod.
 * A substituição é o que dá a garantia: a partir daqui o handler só vê dados
 * com o tipo certo, sem campos extra que o cliente tenha tentado injectar.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) {
        // `req.query` é apenas um getter no Express 5; escrevemos as propriedades.
        const parsed = schemas.query.parse(req.query) as Record<string, unknown>;
        Object.keys(req.query).forEach((k) => {
          delete (req.query as Record<string, unknown>)[k];
        });
        Object.assign(req.query, parsed);
      }
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new AppError(422, "VALIDATION_ERROR", "Dados inválidos.", formatIssues(error)));
        return;
      }
      next(error);
    }
  };
}

export type Infer<T extends ZodTypeAny> = z.infer<T>;
