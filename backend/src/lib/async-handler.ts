import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * O Express 4 não encaminha rejeições de promessas para o middleware de erro.
 * Sem este wrapper, qualquer `await` que falhe deixa o pedido pendurado até
 * expirar — um dos bugs mais difíceis de diagnosticar em APIs Express.
 */
export function asyncHandler<
  Req extends Request = Request,
  Res extends Response = Response,
>(fn: (req: Req, res: Res, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req as Req, res as Res, next)).catch(next);
  };
}
