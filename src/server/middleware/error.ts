import type { ErrorRequestHandler } from "express";
import { AppError, isAppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { requestId } from "../../lib/ids.js";
import type { ApiErrorBody } from "../../types/index.js";

export const notFoundHandler: ErrorRequestHandler = (req, _res, next) => {
  next(new AppError("NOT_FOUND", `No route for ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const id = (res.locals.requestId as string | undefined) ?? requestId();
  const appError = isAppError(error)
    ? error
    : new AppError("INTERNAL", "Unexpected server error");

  if (appError.status >= 500) {
    logger.error({ err: error, requestId: id, path: req.path }, "request failed");
  } else {
    logger.warn({ code: appError.code, requestId: id, path: req.path }, "request rejected");
  }

  const body: ApiErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      requestId: id,
      details: appError.details,
    },
  };

  res.status(appError.status).json(body);
};