import { Router } from "express";
import { prisma } from "../../db/client.js";
import { logger } from "../../lib/logger.js";

export const healthRouter: Router = Router();

healthRouter.get("/health", async (_req, res) => {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      database: { ok: true, latencyMs: Date.now() - startedAt },
    });
  } catch (error) {
    logger.error({ err: error }, "health check failed");
    res.status(503).json({
      status: "degraded",
      database: { ok: false, latencyMs: Date.now() - startedAt },
    });
  }
});