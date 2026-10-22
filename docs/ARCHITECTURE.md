# Architecture notes

## Request flow

```
client -> express app -> middleware chain -> route handler
       -> service -> domain guard -> repository -> Prisma -> Postgres
```

Each hop has one job:

- **Middleware** authenticates, attaches a request id, and normalises errors.
- **Route handlers** validate input with Zod and translate DTOs. They contain no
  branching on business state.
- **Services** own transactions and orchestration. A service may call more than
  one repository but never formats an HTTP response.
- **Domain** functions are pure: `canTransition`, `nextAttemptDelay`, and
  `describeTask` can all be tested without I/O.
- **Repositories** are the only modules aware of Prisma types.

## Failure semantics

| Failure                | Behaviour                                        |
| ---------------------- | ------------------------------------------------ |
| Validation error       | `400` with a field-level issue list              |
| Missing entity         | `404`, no stack trace in the body                |
| Illegal transition     | `409` with the current and requested state       |
| Upstream timeout       | `502`, the attempt is recorded for retry         |
| Unexpected error       | `500`, logged with `requestId`, generic message   |

## Concurrency

Task execution uses an optimistic guard: `taskRepository.claim(id)` performs a
conditional `UPDATE ... WHERE status = 'queued'`. Only one worker can win, so a
duplicated queue message cannot run the same task twice.

## Configuration

All environment access is centralised in `src/lib/config.ts`. It parses once at
startup and throws a readable error listing every invalid variable, which keeps
misconfiguration from surfacing as a random `undefined` later.

## Extending

Add a capability in this order:

1. Domain rule + unit test.
2. Repository method + mapping test.
3. Service orchestration.
4. Route + Zod schema.
5. Client method.

Skipping a step tends to leak framework types into `core/`.