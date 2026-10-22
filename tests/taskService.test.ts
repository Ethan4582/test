import { describe, expect, it, vi } from "vitest";
import { canTransition, describeTask, shouldRetry } from "../src/core/domain/task.js";
import { createTaskService } from "../src/core/services/taskService.js";
import type { Task } from "../src/types/task.js";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "tsk_1",
    userId: "usr_1",
    title: "Sync invoice ledger",
    payload: {},
    status: "pending",
    priority: "normal",
    attempts: 0,
    lastError: null,
    scheduledFor: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function fakeRepository(initial: Task) {
  let current = initial;
  return {
    create: vi.fn(),
    findById: vi.fn(async () => current),
    list: vi.fn(async () => ({ items: [current], nextCursor: null })),
    update: vi.fn(async (_id: string, patch: Partial<Task>) => {
      current = { ...current, ...patch };
      return current;
    }),
    claim: vi.fn(async () => current),
    countByStatus: vi.fn(async () => ({ pending: 1 })),
  };
}

describe("task domain", () => {
  it("allows pending -> queued", () => {
    expect(canTransition("pending", "queued")).toBe(true);
  });

  it("rejects succeeded -> running", () => {
    expect(canTransition("succeeded", "running")).toBe(false);
  });

  it("retries failed tasks below the attempt ceiling", () => {
    expect(shouldRetry(task({ status: "failed", attempts: 2 }))).toBe(true);
    expect(shouldRetry(task({ status: "failed", attempts: 3 }))).toBe(false);
  });

  it("renders attempts in the description", () => {
    expect(describeTask(task({ attempts: 2 }))).toBe("[pending] Sync invoice ledger (attempt 2)");
  });
});

describe("taskService", () => {
  it("queues a pending task and notifies", async () => {
    const repository = fakeRepository(task());
    const notify = vi.fn(async () => undefined);
    const service = createTaskService({ repository, notify });

    const queued = await service.enqueue("usr_1", "tsk_1");

    expect(queued.status).toBe("queued");
    expect(notify).toHaveBeenCalledWith({ kind: "task.queued", taskId: "tsk_1", userId: "usr_1" });
  });

  it("refuses to enqueue a running task", async () => {
    const repository = fakeRepository(task({ status: "running" }));
    const service = createTaskService({ repository, notify: vi.fn(async () => undefined) });

    await expect(service.enqueue("usr_1", "tsk_1")).rejects.toThrow(/not eligible/);
  });
});