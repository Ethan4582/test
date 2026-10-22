import type { CreateTaskInput, Task, TaskFilter } from "../types/task.js";
import type { Page } from "../types/index.js";

export interface ApiClientOptions {
  readonly baseUrl: string;
  readonly userId: string;
  readonly fetchImpl?: typeof fetch;
}

export interface ApiClient {
  listTasks(filter: Partial<TaskFilter>): Promise<Page<Task>>;
  createTask(input: CreateTaskInput): Promise<Task>;
  runTask(id: string): Promise<Task>;
  summary(): Promise<Record<string, number>>;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const http = options.fetchImpl ?? fetch;
  const headers = { "x-user-id": options.userId, "content-type": "application/json" };

  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await http(`${options.baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`API ${path} failed (${response.status}): ${body}`);
    }

    return (await response.json()) as T;
  }

  return {
    listTasks(filter) {
      const params = new URLSearchParams();
      if (filter.status) params.set("status", filter.status);
      if (filter.priority) params.set("priority", filter.priority);
      if (filter.limit) params.set("limit", String(filter.limit));
      return call<Page<Task>>(`/api/tasks?${params.toString()}`);
    },
    createTask(input) {
      return call<Task>("/api/tasks", { method: "POST", body: JSON.stringify(input) });
    },
    runTask(id) {
      return call<Task>(`/api/tasks/${id}/run`, { method: "POST" });
    },
    summary() {
      return call<Record<string, number>>("/api/tasks/summary");
    },
  };
}