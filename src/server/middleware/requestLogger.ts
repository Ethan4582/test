import type { NextFunction, Request, Response } from "express";
import { logger } from "../../lib/logger.js";
import { requestId } from "../../lib/ids.js";

export function attachRequestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.header("x-request-id") ?? requestId();
  res.locals.requestId = id;
  res.setHeader("x-request-id", id);
  next();
}

export function logRequest(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.info(
      {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Number(durationMs.toFixed(1)),
        requestId: res.locals.requestId,
      },
      "request completed",
    );
  });

  next();
}