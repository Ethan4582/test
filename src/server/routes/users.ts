import { Router } from "express";
import { userService } from "../../core/services/userService.js";
import { AppError } from "../../lib/errors.js";
import { requireActor } from "../middleware/auth.js";
import { z } from "zod";
import { parseOrThrow } from "../../lib/validation.js";

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().min(1).max(80),
  timezone: z.string().min(1).max(64).optional(),
});

export const usersRouter: Router = Router();

usersRouter.get("/users/:id", async (req, res, next) => {
  try {
    res.json(await userService.get(req.params.id));
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/users", async (req, res, next) => {
  try {
    const input = parseOrThrow(createUserSchema, req.body);
    res.status(201).json(await userService.register(input));
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/me", requireActor, async (req, res, next) => {
  try {
    const actor = req.actor;
    if (!actor) throw new AppError("UNAUTHORIZED", "Authentication is required");

    res.json(await userService.get(actor.userId));
  } catch (error) {
    next(error);
  }
});