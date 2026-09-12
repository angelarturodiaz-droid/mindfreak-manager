import { listTasks } from "@/features/tasks/queries";
import { listCompanyMembers } from "@/features/projects/queries";
import { listProjectsForSelect } from "@/features/expenses/queries";
import { NewTaskForm } from "@/components/tasks/new-task-form";
import { TaskList } from "@/components/tasks/task-list";
import { TASK_STATUSES } from "@/features/tasks/schema";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En curso",
  DONE: "Hecha",
  CANCELLED: "Cancelada",
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const [tasks, members, projects] = await Promise.all([
    listTasks({ status: params.status }),
    listCompanyMembers(),
    listProjectsForSelect(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Tareas</h1>
        <p className="text-sm text-brand-muted">
          Generales o ligadas a un proyecto específico.
        </p>
      </div>

      <form className="flex gap-2" action="/tasks" method="get">
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">Todos los estados</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-text hover:border-brand-accent"
        >
          Filtrar
        </button>
      </form>

      <NewTaskForm members={members} projects={projects} revalidatePathValue="/tasks" />

      <TaskList tasks={tasks} revalidatePathValue="/tasks" />
    </main>
  );
}
