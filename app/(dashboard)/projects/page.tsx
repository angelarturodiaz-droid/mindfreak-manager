import Link from "next/link";
import { CalendarDays, Plus, ArrowRight } from "lucide-react";
import { listProjects, listConvertibleQuotations } from "@/features/projects/queries";
import { PROJECT_STATUSES } from "@/features/projects/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_LABELS: Record<string, string> = {
  PLANNING: "Planificación",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(
    amount,
  );
}

type ProjectRow = Awaited<ReturnType<typeof listProjects>>[number];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const [projects, convertibleQuotations] = await Promise.all([
    listProjects(params.status),
    listConvertibleQuotations(),
  ]);

  const columns: Column<ProjectRow>[] = [
    {
      header: "Número",
      accessor: (p) => (
        <Link href={`/projects/${p.id}`} className="font-medium text-brand-text hover:text-brand-accent">
          {p.number}
        </Link>
      ),
    },
    { header: "Nombre", accessor: (p) => p.name },
    {
      header: "Cliente",
      accessor: (p) => (
        <span className="text-brand-muted">
          {(p.clients as { name: string }[] | null)?.[0]?.name ?? "—"}
        </span>
      ),
    },
    { header: "Fecha", accessor: (p) => <span className="text-brand-muted">{p.event_date || "—"}</span> },
    { header: "Presupuesto", accessor: (p) => formatMoney(p.budget) },
    {
      header: "Estado",
      accessor: (p) => <Badge status={p.status}>{STATUS_LABELS[p.status] ?? p.status}</Badge>,
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">
            Proyectos / Eventos
          </h1>
          <p className="text-sm text-brand-muted">
            El evento en sí — se crea directo o convirtiendo una cotización aprobada.
          </p>
        </div>
        <Link href="/projects/new">
          <Button size="sm" icon={<Plus size={14} />}>
            Nuevo proyecto directo
          </Button>
        </Link>
      </div>

      {convertibleQuotations.length > 0 && (
        <Card className="border-brand-accent/40 bg-brand-accent-light">
          <p className="mb-2 text-sm font-medium text-brand-text">
            Cotizaciones aprobadas listas para convertir en proyecto
          </p>
          <ul className="space-y-1">
            {convertibleQuotations.map((q) => (
              <li key={q.id} className="flex items-center justify-between text-sm">
                <span>
                  {q.number} —{" "}
                  {(q.clients as { name: string }[] | null)?.[0]?.name ?? "—"} —{" "}
                  {formatMoney(q.total)}
                </span>
                <Link
                  href={`/projects/from-quotation/${q.id}`}
                  className="inline-flex items-center gap-1 text-brand-accent hover:underline"
                >
                  Convertir a proyecto <ArrowRight size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <form className="flex flex-wrap items-end gap-2" action="/projects" method="get">
        <Select name="status" defaultValue={params.status ?? ""} className="w-48">
          <option value="">Todos los estados</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline" size="md">
          Filtrar
        </Button>
      </form>

      {projects.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={28} />}
          title="Aún no tienes proyectos que coincidan con este filtro."
        />
      ) : (
        <DataTable columns={columns} rows={projects} keyFor={(p) => p.id} />
      )}
    </main>
  );
}
