import type { Task } from "../../types/task.js";

export interface TaskListProps {
  readonly tasks: readonly Task[];
  readonly onRun?: (task: Task) => void;
}

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

export function TaskList({ tasks, onRun }: TaskListProps) {
  if (tasks.length === 0) {
    return <p className="empty">No tasks yet. Create one to get started.</p>;
  }

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <li key={task.id} className={`task task--${task.status}`}>
          <div className="task__head">
            <strong>{task.title}</strong>
            <span className="task__priority">{PRIORITY_LABEL[task.priority]}</span>
          </div>
          <p className="task__meta">
            {task.status} · attempts {task.attempts}
            {task.lastError ? ` · ${task.lastError}` : ""}
          </p>
          {onRun && task.status === "pending" ? (
            <button type="button" onClick={() => onRun(task)}>
              Run now
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}