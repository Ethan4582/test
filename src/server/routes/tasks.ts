import { Router } from "express";
import { taskService } from "../../core/services/taskService.js";
import { parseOrThrow, createTaskSchema, listTasksSchema, updateTaskSchema } from "../../lib/validation.js";
import { AppError } from "../../lib/errors.js";
import { requireActor, requireScope } from "../middleware/auth.js";

export const tasksRouter: Router = Router();

tasksRouter.use(requireActor);

tasksRouter.get("/tasks", requireScope("tasks:read"), async (req, res, next) => {
  try {
    const query = parseOrThrow(listTasksSchema, req.query);
    const actor = req.actor;
    if (!actor) throw new AppError("UNAUTHORIZED", "Authentication is required");

    const page = await taskService.list({
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });

    res.json(page);
  } catch (error) {
    next(error);
  }
});

tasksRouter.post("/tasks", requireScope("tasks:write"), async (req, res, next) => {
  try {
    const input = parseOrThrow(createTaskSchema, req.body);
    const actor = req.actor;
    if (!actor) throw new AppError("UNAUTHORIZED", "Authentication is required");

    const task = await taskService.create(actor.userId, input);
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

tasksRouter.get("/tasks/:id", requireScope("tasks:read"), async (req, res, next) => {
  try {
    const actor = req.actor;
    if (!actor) throw new AppError("UNAUTHORIZED", "Authentication is required");
    res.json(await taskService.get(actor.userId, req.params.id));
  } catch (error) {
    next(error);
  }
});

tasksRouter.patch("/tasks/:id", requireScope("tasks:write"), async (req, res, next) => {
  try {
    const patch = parseOrThrow(updateTaskSchema, req.body);
    const actor = req.actor;
    if (!actor) throw new AppError("UNAUTHORIZED", "Authentication is required");

    res.json(await taskService.update(actor.userId, req.params.id, patch));
  } catch (error) {
    next(error);
  }
});

tasksRouter.post("/tasks/:id/run", requireScope("tasks:write"), async (req, res, next) => {
  try {
    const actor = req.actor;
    if (!actor) throw new AppError("UNAUTHORIZED", "Authentication is required");

    res.status(202).json(await taskService.enqueue(actor.userId, req.params.id));
  } catch (error) {
    next(error);
  }
});