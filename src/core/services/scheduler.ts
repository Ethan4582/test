import { isPast } from "../../lib/time.js";
import { logger } from "../../lib/logger.js";
import { loadConfig } from "../../lib/config.js";
import { taskRepository } from "../../db/repositories/taskRepository.js";
import { taskService } from "./taskService.js";
import type { Task } from "../../types/task.js";

const config = loadConfig();
const TICK_MS = 15_000;

let timer: NodeJS.Timeout | null = null;
let ticking = false;

export interface SchedulerHooks {
  readonly loadDue?: () => Promise<Task[]>;
  readonly run?: (task: Task) => Promise<void>;
}

async function defaultLoadDue(): Promise<Task[]> {
  const { items } = await taskRepository.list({ limit: 20, status: "queued" });
  return items.filter((task) => !task.scheduledFor || isPast(task.scheduledFor));
}

async function defaultRun(task: Task): Promise<void> {
  const claimed = await taskService.claim(task.id);
  if (!claimed) return;

  try {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await taskService.recordSuccess(task.id);
  } catch (error) {
    await taskService.recordFailure(
      task.id,
      error instanceof Error ? error.message : "unknown failure",
    );
  }
}

async function tick(hooks: SchedulerHooks): Promise<void> {
  if (ticking) return;
  ticking = true;

  try {
    const due = await (hooks.loadDue ?? defaultLoadDue)();
    for (const task of due) {
      await (hooks.run ?? defaultRun)(task);
    }
  } catch (error) {
    logger.error({ err: error }, "scheduler tick failed");
  } finally {
    ticking = false;
  }
}

export function startScheduler(hooks: SchedulerHooks = {}): void {
  if (config.EMERGENCY_MODE) {
    logger.warn("EMERGENCY_MODE is on; scheduler not started");
    return;
  }
  if (timer) return;

  timer = setInterval(() => {
    void tick(hooks);
  }, TICK_MS);
  timer.unref();
  logger.info({ intervalMs: TICK_MS }, "scheduler started");
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info("scheduler stopped");
  }
}

export async function runOnce(hooks: SchedulerHooks = {}): Promise<void> {
  await tick(hooks);
}