# TaskFlow

TaskFlow is a small task-automation service. Users create task queues, rules
decide when a task should run, and workers report progress through a typed
service layer. The project is intentionally modular so each concern can be
tested and replaced independently.

## Architecture

```
src/
  client/                 Browser code (API client + React views)
  server/                 HTTP transport: app wiring, routes, middleware
  core/                   Business rules, independent of Express and Prisma
    domain/               Pure entities and state transitions
    services/             Use cases composing repositories and gateways
  db/                     Prisma schema, client singleton, repositories
  lib/                    Cross-cutting helpers (config, logging, http)
  types/                  Shared discriminated unions and DTOs
```

Rules that keep the boundaries honest:

1. `core/` never imports `express` or `@prisma/client`.
2. `server/` never reaches into Prisma directly; it calls services.
3. Repositories map database rows into domain objects and back.
4. `lib/` is leaf code: it must not know about tasks or users.

See `docs/ARCHITECTURE.md` for request flow and failure semantics.

## Getting started

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The API listens on `http://localhost:4000`.

## API

| Method | Path                 | Description                        |
| ------ | -------------------- | ---------------------------------- |
| GET    | `/health`            | Liveness and dependency probes      |
| GET    | `/api/users/:id`      | Fetch a single user                 |
| POST   | `/api/tasks`         | Create a task for the current user  |
| GET    | `/api/tasks`         | List tasks, filterable by status    |
| PATCH  | `/api/tasks/:id`     | Update status or priority           |
| POST   | `/api/tasks/:id/run` | Queue an immediate run              |

Authentication is a signed `x-user-id` header in development and a JWT in
production; `src/server/middleware/auth.ts` owns both paths.

## Task lifecycle

```
pending -> queued -> running -> succeeded
                 \-> failed -> queued (retry)
```

Transitions are enforced in `src/core/domain/task.ts`; anything not listed
there is rejected before it reaches the database.

## Testing

`pnpm test` runs unit tests for the domain and service layers. Repository
tests require a database and are skipped unless `DATABASE_URL` is present.

## Operational notes

- Structured logs go to stdout (`pino`), one JSON object per line.
- Outbound webhooks are retried three times with exponential backoff.
- `EMERGENCY_MODE=true` disables the scheduler without dropping requests.