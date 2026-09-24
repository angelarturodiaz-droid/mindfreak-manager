"use client";

import { useTransition } from "react";
import Link from "next/link";
import { updateTaskStatusAction, deleteTaskAction } from "@/features/tasks/actions";
import { TASK_STATUSES } from "@/features/tasks/schema";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Chip, InitialsAvatar } from "@/components/ui/page-kit";
import { dueLabel, formatDate, pluralDays } from "@/lib/utils/dates";

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

const PRIORITY_CLASSES: Record<string, string> = {
  HIGH: "bg-brand-danger-bg text-brand-danger",
  MEDIUM: "bg-brand-warning-bg text-brand-warning",
  LOW: "bg-brand-surface-hover text-brand-muted",
};

const STATUS_SELECT_CLASSES: Record<string, string> = {
  PENDING: "border-brand-warning/40 bg-brand-warning-bg text-brand-warning",
  IN_PROGRESS: "border-brand-accent/40 bg-brand-accent-light text-brand-accent",
  DONE: "border-brand-success/40 bg-brand-success-bg text-brand-success",
  CANCELLED: "border-brand-border bg-brand-surface-hover text-brand-muted",
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
  const closed = task.status === "DONE" || task.status === "CANCELLED";
  const due = task.due_date && !closed ? dueLabel(task.due_date) : null;

  return (
    <tr className="border-b border-brand-border/60 bg-brand-surface transition-colors last:border-0 hover:bg-brand-surface-hover">
      <td className="px-4 py-3">
        <p className={`font-medium ${closed ? "text-brand-muted line-through" : "text-brand-text"}`}>{task.title}</p>
        {task.description && <p className="mt-0.5 max-w-md text-xs text-brand-muted">{task.description}</p>}
      </td>
      {showProjectColumn && (
        <td className="px-4 py-3">
          {project && task.project_id ? (
            <Link href={`/projects/${task.project_id}?tab=tareas`} className="block hover:text-brand-accent">
              <span className="block text-brand-text">{project.number}</span>
              <span className="block max-w-[12rem] truncate text-xs text-brand-muted">{project.name}</span>
            </Link>
          ) : (
            <span className="text-xs text-brand-muted">General</span>
          )}
        </td>
      )}
      <td className="px-4 py-3">
        {assignee?.full_name ? (
          <span className="flex items-center gap-2">
            <InitialsAvatar name={assignee.full_name} size="sm" />
            <span className="text-brand-text">{assignee.full_name}</span>
          </span>
        ) : (
          <span className="text-brand-muted">Sin asignar</span>
        )}
      </td>
      <td className="px-4 py-3">
        {task.due_date ? (
          <div className="flex flex-col items-start gap-1">
            <span className="whitespace-nowrap text-brand-muted">{formatDate(task.due_date)}</span>
            {due && (
              <Chip tone={due.days < 0 ? "danger" : due.days <= 1 ? "warning" : "muted"}>
                {due.days < 0 ? `Atrasada ${pluralDays(-due.days)}` : due.label}
              </Chip>
            )}
          </div>
        ) : (
          <span className="text-brand-muted">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASSES[task.priority] ?? PRIORITY_CLASSES.LOW}`}>
          {PRIORITY_LABELS[task.priority] ?? task.priority}
        </span>
      </td>
      <td className="px-4 py-3">
        <select
          value={task.status}
          disabled={isPending}
          aria-label="Cambiar estado"
          onChange={(e) =>
            startTransition(() =>
              updateTaskStatusAction(task.id, e.target.value, revalidatePathValue),
            )
          }
          className={`rounded-full border px-2.5 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-brand-accent disabled:opacity-60 ${STATUS_SELECT_CLASSES[task.status] ?? ""}`}
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
    return (
      <p className="rounded-[var(--radius-lg)] border border-dashed border-brand-border p-6 text-center text-sm text-brand-muted">
        Sin tareas todavía.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-brand-border">
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
