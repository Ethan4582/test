export const TASK_STATUSES = [
  "pending",
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "normal", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly payload: Record<string, unknown>;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly scheduledFor: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateTaskInput {
  readonly title: string;
  readonly payload?: Record<string, unknown>;
  readonly priority?: TaskPriority;
  readonly scheduledFor?: Date;
}

export interface UpdateTaskInput {
  readonly title?: string;
  readonly priority?: TaskPriority;
  readonly status?: TaskStatus;
}

export interface TaskFilter {
  readonly status?: TaskStatus;
  readonly priority?: TaskPriority;
  readonly limit: number;
  readonly cursor?: string;
}