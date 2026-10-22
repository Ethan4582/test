import { PrismaClient } from "@prisma/client";
import { loadConfig } from "../lib/config.js";
import { logger } from "../lib/logger.js";

const config = loadConfig();

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: config.DATABASE_URL } },
    log: [
      { emit: "event", level: "warn" },
      { emit: "event", level: "error" },
    ],
  });

prisma.$on("warn", (event) => logger.warn(event, "prisma warning"));
prisma.$on("error", (event) => logger.error(event, "prisma error"));

if (config.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}