import { logger } from "../../lib/logger.js";
import { requestJson } from "../../lib/http.js";
import { loadConfig } from "../../lib/config.js";

export type NotificationEvent =
  | { kind: "task.created" | "task.queued" | "task.started"; taskId: string; userId: string }
  | { kind: "task.succeeded" | "task.failed"; taskId: string; userId: string; detail?: string };

export interface NotificationTarget {
  readonly userId: string;
  readonly webhookUrl: string | null;
}

const config = loadConfig();
const targets = new Map<string, NotificationTarget>();

export function registerTarget(target: NotificationTarget): void {
  targets.set(target.userId, target);
}

export function clearTargets(): void {
  targets.clear();
}

async function deliver(target: NotificationTarget, event: NotificationEvent): Promise<void> {
  if (!target.webhookUrl) {
    logger.debug({ event }, "no webhook configured, skipping delivery");
    return;
  }

  await requestJson(target.webhookUrl, {
    method: "POST",
    headers: { "x-taskflow-signature": config.WEBHOOK_SECRET },
    body: event,
    retries: 2,
  });
}

export const notificationService = {
  async notify(event: NotificationEvent): Promise<void> {
    const target = targets.get(event.userId);
    if (!target) return;

    try {
      await deliver(target, event);
    } catch (error) {
      logger.warn({ err: error, event }, "notification delivery failed");
    }
  },
};