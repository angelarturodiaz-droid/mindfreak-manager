import { AlertTriangle, CheckCircle2, CircleDashed, Loader } from "lucide-react";
import { listTasks } from "@/features/tasks/queries";
import { listCompanyMembers } from "@/features/projects/queries";
import { listProjectsForSelect } from "@/features/expenses/queries";
import { NewTaskForm } from "@/components/tasks/new-task-form";
import { TaskList } from "@/components/tasks/task-list";
import { TASK_STATUSES } from "@/features/tasks/schema";
import { Card } from "@/components/ui/card";
import { FilterPills, StatCard, StatGrid, listHref } from "@/components/ui/page-kit";
import { todayISO } from "@/lib/utils/dates";

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
  // Todas las tareas para los conteos; la lista usa el filtro de estado.
  const [allTasks, members, projects] = await Promise.all([
    listTasks({}),
    listCompanyMembers(),
    listProjectsForSelect(),
  ]);
  const tasks = params.status ? allTasks.filter((t) => t.status === params.status) : allTasks;

  const today = todayISO();
  const byStatus: Record<string, number> = {};
  let overdue = 0;
  for (const t of allTasks) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    if (t.due_date && t.due_date < today && (t.status === "PENDING" || t.status === "IN_PROGRESS")) overdue += 1;
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Tareas</h1>
        <p className="text-sm text-brand-muted">
          Generales o ligadas a un proyecto específico. Cambia el estado directamente en la lista.
        </p>
      </div>

      <StatGrid>
        <StatCard
          label="Pendientes"
          value={String(byStatus.PENDING ?? 0)}
          hint="Por empezar"
          icon={<CircleDashed size={20} />}
          tone="amber"
        />
        <StatCard
          label="En curso"
          value={String(byStatus.IN_PROGRESS ?? 0)}
          hint="Trabajándose ahora"
          icon={<Loader size={20} />}
          tone="blue"
        />
        <StatCard
          label="Atrasadas"
          value={String(overdue)}
          valueTone={overdue > 0 ? "danger" : undefined}
          hint="Abiertas con fecha pasada"
          icon={<AlertTriangle size={20} />}
          tone="red"
        />
        <StatCard
          label="Hechas"
          value={String(byStatus.DONE ?? 0)}
          hint="Completadas"
          icon={<CheckCircle2 size={20} />}
          tone="green"
        />
      </StatGrid>

      <Card>
        <p className="mb-3 text-sm font-semibold text-brand-text">Nueva tarea</p>
        <NewTaskForm members={members} projects={projects} revalidatePathValue="/tasks" />
      </Card>

      <section className="flex flex-col gap-4">
        <FilterPills
          label="Filtrar por estado"
          items={[undefined, ...TASK_STATUSES].map((s) => ({
            key: s ?? "all",
            label: s ? STATUS_LABELS[s] ?? s : "Todas",
            count: s ? byStatus[s] ?? 0 : allTasks.length,
            active: (params.status ?? undefined) === s,
            href: listHref("/tasks", { status: s }),
          }))}
        />
        <TaskList tasks={tasks} revalidatePathValue="/tasks" />
      </section>
    </main>
  );
}
