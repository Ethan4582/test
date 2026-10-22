import { AppError } from "./errors.js";
import { logger } from "./logger.js";

const DEFAULT_TIMEOUT = 10_000;

export interface HttpOptions {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly timeoutMs?: number;
  readonly retries?: number;
}

async function once<T>(url: string, options: HttpOptions): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT,
  );

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AppError(
        "UPSTREAM_FAILED",
        `Upstream responded with ${response.status}`,
        { url, status: response.status },
      );
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestJson<T>(url: string, options: HttpOptions = {}): Promise<T> {
  const attempts = (options.retries ?? 2) + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await once<T>(url, options);
    } catch (error) {
      lastError = error;
      logger.warn({ url, attempt, err: error }, "upstream request failed");
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new AppError("UPSTREAM_FAILED", "Upstream request failed");
}