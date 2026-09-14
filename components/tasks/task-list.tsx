"use client";

import { useTransition } from "react";
import { updateTaskStatusAction, deleteTaskAction } from "@/features/tasks/actions";
import { TASK_STATUSES } from "@/features/tasks/schema";
import { ConfirmButton } from "@/components/ui/confirm-button";

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
    <tr className="border-b border-brand-border/60 bg-brand-surface transition-colors last:border-0 hover:bg-brand-surface-hover">
      <td className="px-4 py-3">
        <p className="font-medium text-brand-text">{task.title}</p>
        {task.description && <p className="text-xs text-brand-muted">{task.description}</p>}
      </td>
      {showProjectColumn && (
        <td className="px-4 py-3 text-brand-muted">
          {project ? `${project.number} — ${project.name}` : "—"}
        </td>
      )}
      <td className="px-4 py-3 text-brand-muted">{assignee?.full_name ?? "Sin asignar"}</td>
      <td className="px-4 py-3 text-brand-muted">{task.due_date ?? "—"}</td>
      <td className="px-4 py-3 text-brand-muted">{PRIORITY_LABELS[task.priority] ?? task.priority}</td>
      <td className="px-4 py-3">
        <select
          value={task.status}
          disabled={isPending}
          onChange={(e) =>
            startTransition(() =>
              updateTaskStatusAction(task.id, e.target.value, revalidatePathValue),
            )
          }
          className="rounded-[var(--radius-sm)] border border-brand-border bg-brand-surface px-2 py-1 text-xs outline-none focus:border-brand-accent"
        >
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 text-right">
        <ConfirmButton
          label="Eliminar"
          confirmTitle={`¿Eliminar la tarea "${task.title}"?`}
          onConfirm={() => deleteTaskAction(task.id, revalidatePathValue)}
        />
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
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-brand-border max-w-4xl">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-brand-border bg-brand-background text-left text-xs font-medium uppercase tracking-wide text-brand-muted">
            <th className="px-4 py-3">Tarea</th>
            {showProjectColumn && <th className="px-4 py-3">Proyecto</th>}
            <th className="px-4 py-3">Asignado</th>
            <th className="px-4 py-3">Vence</th>
            <th className="px-4 py-3">Prioridad</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3"></th>
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
    </div>
  );
}
