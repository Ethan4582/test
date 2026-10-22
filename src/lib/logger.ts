import { pino } from "pino";
import { loadConfig } from "./config.js";

const config = loadConfig();

export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: "taskflow" },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ["req.headers.authorization", "*.password", "*.token"],
    censor: "[redacted]",
  },
});

export type Logger = typeof logger;

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}