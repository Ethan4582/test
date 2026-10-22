import { z } from "zod";
import { AppError } from "./errors.js";
import { TASK_PRIORITIES, TASK_STATUSES } from "../types/task.js";

export const createTaskSchema = z.object({
  title: z.string().trim().min(3).max(200),
  payload: z.record(z.unknown()).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  scheduledFor: z.coerce.date().optional(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    status: z.enum(TASK_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const listTasksSchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

export function parseOrThrow<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  throw new AppError(
    "VALIDATION_FAILED",
    "Request payload is invalid",
    result.error.flatten(),
  );
}