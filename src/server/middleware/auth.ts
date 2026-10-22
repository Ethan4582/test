import type { NextFunction, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../../lib/errors.js";
import { loadConfig } from "../../lib/config.js";
import type { AuthenticatedActor } from "../../types/user.js";

const config = loadConfig();

declare module "express-serve-static-core" {
  interface Request {
    actor?: AuthenticatedActor;
  }
}

function verifySignature(userId: string, signature: string): boolean {
  const expected = createHmac("sha256", config.WEBHOOK_SECRET)
    .update(userId)
    .digest("hex");

  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function requireActor(req: Request, _res: Response, next: NextFunction): void {
  if (config.NODE_ENV !== "production") {
    const userId = req.header("x-user-id");
    if (!userId) {
      next(new AppError("UNAUTHORIZED", "x-user-id header is required in development"));
      return;
    }
    req.actor = { userId, scopes: ["tasks:read", "tasks:write"] };
    next();
    return;
  }

  const userId = req.header("x-user-id");
  const signature = req.header("x-user-signature");
  if (!userId || !signature || !verifySignature(userId, signature)) {
    next(new AppError("UNAUTHORIZED", "A valid signed identity is required"));
    return;
  }

  req.actor = { userId, scopes: ["tasks:read", "tasks:write"] };
  next();
}

export function requireScope(scope: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const actor = req.actor;
    if (!actor) {
      next(new AppError("UNAUTHORIZED", "Authentication is required"));
      return;
    }
    if (!actor.scopes.includes(scope)) {
      next(new AppError("UNAUTHORIZED", `Missing scope: ${scope}`));
      return;
    }
    next();
  };
}