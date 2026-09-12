"use client";

import { useTransition } from "react";
import { updateTaskStatusAction, deleteTaskAction } from "@/features/tasks/actions";
import { TASK_STATUSES } from "@/features/tasks/schema";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En curso",
  DONE: "Hecha",
  CANCELLED: "Cancelada",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  priority: string;
  project_id: string | null;
  projects?: { number: string; name: string } | { number: string; name: string }[] | null;
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
};

function TaskRow({
  task,
  showProjectColumn,
  revalidatePathValue,
}: {
  task: Task;
  showProjectColumn: boolean;
  revalidatePathValue: string;
}) {
  const [isPending, startTransition] = useTransition();

  const project = Array.isArray(task.projects) ? task.projects[0] : task.projects;
  const assignee = Array.isArray(task.profiles) ? task.profiles[0] : task.profiles;

  return (
    <tr className="border-b border-brand-muted/10">
      <td className="py-2">
        <p className="font-medium text-brand-text">{task.title}</p>
        {task.description && <p className="text-xs text-brand-muted">{task.description}</p>}
      </td>
      {showProjectColumn && (
        <td className="py-2 text-brand-muted">
          {project ? `${project.number} — ${project.name}` : "—"}
        </td>
      )}
      <td className="py-2 text-brand-muted">{assignee?.full_name ?? "Sin asignar"}</td>
      <td className="py-2 text-brand-muted">{task.due_date ?? "—"}</td>
      <td className="py-2 text-brand-muted">{PRIORITY_LABELS[task.priority] ?? task.priority}</td>
      <td className="py-2">
        <select
          value={task.status}
          disabled={isPending}
          onChange={(e) =>
            startTransition(() =>
              updateTaskStatusAction(task.id, e.target.value, revalidatePathValue),
            )
          }
          className="border border-brand-muted/30 bg-brand-surface px-2 py-1 text-xs outline-none focus:border-brand-accent"
        >
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 text-right">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (window.confirm(`¿Eliminar la tarea "${task.title}"?`)) {
              startTransition(() => deleteTaskAction(task.id, revalidatePathValue));
            }
          }}
          className="text-brand-muted hover:text-brand-danger disabled:opacity-50"
        >
          Eliminar
        </button>
      </td>
    </tr>
  );
}

export function TaskList({
  tasks,
  showProjectColumn = true,
  revalidatePathValue,
}: {
  tasks: Task[];
  showProjectColumn?: boolean;
  revalidatePathValue: string;
}) {
  if (tasks.length === 0) {
    return <p className="text-sm text-brand-muted">Sin tareas todavía.</p>;
  }

  return (
    <table className="w-full max-w-4xl border-collapse text-sm">
      <thead>
        <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
          <th className="py-2 font-medium">Tarea</th>
          {showProjectColumn && <th className="py-2 font-medium">Proyecto</th>}
          <th className="py-2 font-medium">Asignado</th>
          <th className="py-2 font-medium">Vence</th>
          <th className="py-2 font-medium">Prioridad</th>
          <th className="py-2 font-medium">Estado</th>
          <th className="py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            showProjectColumn={showProjectColumn}
            revalidatePathValue={revalidatePathValue}
          />
        ))}
      </tbody>
    </table>
  );
}
