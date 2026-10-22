import { useCallback, useEffect, useState } from "react";
import { TaskForm } from "../components/TaskForm.js";
import { TaskList } from "../components/TaskList.js";
import { createApiClient } from "../api.js";
import type { Task } from "../../types/task.js";

export interface DashboardProps {
  readonly baseUrl: string;
  readonly userId: string;
}

export function Dashboard({ baseUrl, userId }: DashboardProps) {
  const [tasks, setTasks] = useState<readonly Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const client = createApiClient({ baseUrl, userId });

  const refresh = useCallback(async () => {
    try {
      const page = await client.listTasks({ limit: 25 });
      setTasks(page.items);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate(input: { title: string; priority: Task["priority"] }) {
    await client.createTask(input);
    await refresh();
  }

  async function handleRun(task: Task) {
    await client.runTask(task.id);
    await refresh();
  }

  return (
    <main className="dashboard">
      <header>
        <h1>TaskFlow</h1>
        <p>Automate recurring work without leaving the dashboard.</p>
      </header>

      <TaskForm onSubmit={handleCreate} />

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p>Loading tasks…</p> : <TaskList tasks={tasks} onRun={handleRun} />}
    </main>
  );
}