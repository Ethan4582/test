import type { Task as TaskRow, Prisma } from "@prisma/client";
import { prisma } from "../client.js";
import type { Task, TaskFilter, TaskStatus } from "../../types/task.js";

function toDomain(row: TaskRow): Task {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    status: row.status as TaskStatus,
    priority: row.priority as Task["priority"],
    attempts: row.attempts,
    lastError: row.lastError,
    scheduledFor: row.scheduledFor,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const taskRepository = {
  async create(input: {
    userId: string;
    title: string;
    payload: Record<string, unknown>;
    priority: Task["priority"];
    scheduledFor: Date | null;
  }): Promise<Task> {
    const row = await prisma.task.create({
      data: {
        userId: input.userId,
        title: input.title,
        payload: input.payload as Prisma.InputJsonValue,
        priority: input.priority,
        scheduledFor: input.scheduledFor,
      },
    });
    return toDomain(row);
  },

  async findById(id: string): Promise<Task | null> {
    const row = await prisma.task.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  },

  async list(filter: TaskFilter): Promise<{ items: Task[]; nextCursor: string | null }> {
    const rows = await prisma.task.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.priority ? { priority: filter.priority } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > filter.limit;
    const visible = hasMore ? rows.slice(0, filter.limit) : rows;

    return {
      items: visible.map(toDomain),
      nextCursor: hasMore ? (visible.at(-1)?.id ?? null) : null,
    };
  },

  async update(
    id: string,
    patch: {
      title?: string;
      priority?: Task["priority"];
      status?: TaskStatus;
      attempts?: number;
      lastError?: string | null;
    },
  ): Promise<Task> {
    const row = await prisma.task.update({ where: { id }, data: patch });
    return toDomain(row);
  },

  async claim(id: string): Promise<Task | null> {
    const updated = await prisma.task.updateMany({
      where: { id, status: "queued" },
      data: { status: "running", attempts: { increment: 1 } },
    });
    if (updated.count === 0) return null;
    return this.findById(id);
  },

  async countByStatus(userId: string): Promise<Record<string, number>> {
    const grouped = await prisma.task.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    });
    return Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
  },
};