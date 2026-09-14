import { listTasks } from "@/features/tasks/queries";
import { listCompanyMembers } from "@/features/projects/queries";
import { listProjectsForSelect } from "@/features/expenses/queries";
import { NewTaskForm } from "@/components/tasks/new-task-form";
import { TaskList } from "@/components/tasks/task-list";
import { TASK_STATUSES } from "@/features/tasks/schema";
import { Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

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

      <form className="flex flex-wrap items-end gap-2" action="/tasks" method="get">
        <Select name="status" defaultValue={params.status ?? ""} className="w-48">
          <option value="">Todos los estados</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline" size="md">
          Filtrar
        </Button>
      </form>

      <NewTaskForm members={members} projects={projects} revalidatePathValue="/tasks" />

      <TaskList tasks={tasks} revalidatePathValue="/tasks" />
    </main>
  );
}
