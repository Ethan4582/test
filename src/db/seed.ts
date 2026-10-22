import { prisma, disconnect } from "./client.js";
import { logger } from "../lib/logger.js";

const SAMPLE_TASKS = [
  { title: "Sync invoice ledger", priority: "high", status: "queued" },
  { title: "Refresh catalog cache", priority: "normal", status: "pending" },
  { title: "Archive stale sessions", priority: "low", status: "succeeded" },
];

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: "demo@taskflow.local" },
    update: {},
    create: {
      email: "demo@taskflow.local",
      displayName: "Demo Operator",
      timezone: "Asia/Kolkata",
    },
  });

  for (const sample of SAMPLE_TASKS) {
    await prisma.task.create({
      data: {
        userId: user.id,
        title: sample.title,
        priority: sample.priority,
        status: sample.status,
        payload: { source: "seed" },
      },
    });
  }

  logger.info({ userId: user.id }, "seed complete");
}

main()
  .catch((error) => {
    logger.error({ err: error }, "seed failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnect();
  });