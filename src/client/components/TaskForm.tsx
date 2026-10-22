import { useState } from "react";
import type { CreateTaskInput, TaskPriority } from "../../types/task.js";

export interface TaskFormProps {
  readonly onSubmit: (input: CreateTaskInput) => Promise<void>;
}

export function TaskForm({ onSubmit }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 3 || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit({ title: title.trim(), priority });
      setTitle("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <label>
        Title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Sync invoice ledger"
          maxLength={200}
        />
      </label>
      <label>
        Priority
        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value as TaskPriority)}
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
      </label>
      <button type="submit" disabled={submitting || title.trim().length < 3}>
        {submitting ? "Creating…" : "Create task"}
      </button>
    </form>
  );
}