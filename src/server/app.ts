import express, { type Express } from "express";
import { tasksRouter } from "./routes/tasks.js";
import { usersRouter } from "./routes/users.js";
import { healthRouter } from "./routes/health.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { attachRequestId, logRequest } from "./middleware/requestLogger.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));
  app.use(attachRequestId);
  app.use(logRequest);

  app.use(healthRouter);
  app.use("/api", usersRouter);
  app.use("/api", tasksRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}