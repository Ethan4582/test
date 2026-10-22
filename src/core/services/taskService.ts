import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { newId } from "../../lib/ids.js";
import { addSeconds } from "../../lib/time.js";
import { taskRepository } from "../../db/repositories/taskRepository.js";
import { assertTransition, shouldRetry } from "../domain/task.js";
import type { CreateTaskInput, Task, TaskFilter, TaskStatus, UpdateTaskInput } from "../../types/task.js";
import { notificationService } from "./notificationService.js";

export interface TaskServiceDeps {
  readonly repository: typeof taskRepository;
  readonly notify: typeof notificationService.notify;
}

const defaults: TaskServiceDeps = {
  repository: taskRepository,
  notify: notificationService.notify,
};

export function createTaskService(deps: Partial<TaskServiceDeps> = {}) {
  const { repository, notify } = { ...defaults, ...deps };

  return {
    async create(userId: string, input: CreateTaskInput): Promise<Task> {
      const task = await repository.create({
        userId,
        title: input.title.trim(),
        payload: input.payload ?? {},
        priority: input.priority ?? "normal",
        scheduledFor: input.scheduledFor ?? null,
      });

      await notify({ kind: "task.created", taskId: task.id, userId });
      return task;
    },

    async get(userId: string, taskId: string): Promise<Task> {
      const task = await repository.findById(taskId);
      if (!task || task.userId !== userId) {
        throw new NotFoundError("Task", taskId);
      }
      return task;
    },

    async list(filter: TaskFilter): Promise<{ items: Task[]; nextCursor: string | null }> {
      return repository.list(filter);
    },

    async update(userId: string, taskId: string, patch: UpdateTaskInput): Promise<Task> {
      const task = await this.get(userId, taskId);

      if (patch.status && patch.status !== task.status) {
        try {
          assertTransition(task, patch.status);
        } catch (error) {
          throw new ConflictError(
            error instanceof Error ? error.message : "Illegal transition",
            { from: task.status, to: patch.status },
          );
        }
      }

      return repository.update(taskId, patch);
    },

    async enqueue(userId: string, taskId: string): Promise<Task> {
      const task = await this.get(userId, taskId);
      if (task.status !== "pending" && !shouldRetry(task)) {
        throw new ConflictError("Task is not eligible to run", { status: task.status });
      }

      const queued = await repository.update(taskId, { status: "queued", lastError: null });
      await notify({ kind: "task.queued", taskId, userId });
      return queued;
    },

    async claim(taskId: string): Promise<Task | null> {
      const claimed = await repository.claim(taskId);
      if (!claimed) return null;

      await notify({ kind: "task.started", taskId, userId: claimed.userId });
      return claimed;
    },

    async recordSuccess(taskId: string): Promise<Task> {
      const task = await repository.findById(taskId);
      if (!task) throw new NotFoundError("Task", taskId);
      return repository.update(taskId, { status: "succeeded", lastError: null });
    },

    async recordFailure(taskId: string, reason: string): Promise<Task> {
      const task = await repository.findById(taskId);
      if (!task) throw new NotFoundError("Task", taskId);

      const failed = await repository.update(taskId, {
        status: "failed",
        lastError: reason.slice(0, 500),
      });

      if (shouldRetry(failed)) {
        const delay = addSeconds(new Date(), 5 * failed.attempts);
        return repository.update(taskId, {
          status: "queued",
          scheduledFor: delay,
        });
      }

      return failed;
    },

    async summary(userId: string): Promise<Record<string, number>> {
      return repository.countByStatus(userId);
    },
  };
}

export type TaskService = ReturnType<typeof createTaskService>;
export const taskService = createTaskService();
export const taskCorrelationId = (): string => newId("corr");