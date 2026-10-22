import type { Task, TaskStatus } from "../../types/task.js";

const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ["queued", "cancelled"],
  queued: ["running", "cancelled"],
  running: ["succeeded", "failed"],
  failed: ["queued", "cancelled"],
  succeeded: [],
  cancelled: [],
};

export const TERMINAL_STATUSES: readonly TaskStatus[] = ["succeeded", "cancelled"];

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(task: Task, next: TaskStatus): void {
  if (!canTransition(task.status, next)) {
    throw new Error(`Cannot move task ${task.id} from ${task.status} to ${next}`);
  }
}

export function isTerminal(task: Task): boolean {
  return TERMINAL_STATUSES.includes(task.status);
}

export function shouldRetry(task: Task, maxAttempts = 3): boolean {
  return task.status === "failed" && task.attempts < maxAttempts;
}

export function describeTask(task: Task): string {
  const suffix = task.attempts > 0 ? ` (attempt ${task.attempts})` : "";
  return `[${task.status}] ${task.title}${suffix}`;
}