import { createApp } from "./app.js";
import { loadConfig } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import { disconnect } from "../db/client.js";
import { startScheduler, stopScheduler } from "../core/services/scheduler.js";

const config = loadConfig();
const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, "taskflow api listening");
});

startScheduler();

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  stopScheduler();

  server.close(async () => {
    await disconnect();
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));