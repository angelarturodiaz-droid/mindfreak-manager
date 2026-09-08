import Link from "next/link";
import { listProjects, listConvertibleQuotations } from "@/features/projects/queries";
import { PROJECT_STATUSES } from "@/features/projects/schema";

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

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">
            Proyectos / Eventos
          </h1>
          <p className="text-sm text-brand-muted">
            El evento en sí — se crea directo o convirtiendo una cotización aprobada.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Nuevo proyecto directo
        </Link>
      </div>

      {convertibleQuotations.length > 0 && (
        <div className="border border-brand-accent/40 bg-brand-accent/5 p-4">
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
                  className="text-brand-accent hover:underline"
                >
                  Convertir a proyecto →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form className="flex gap-2" action="/projects" method="get">
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">Todos los estados</option>
          {PROJECT_STATUSES.map((s) => (
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

      {projects.length === 0 ? (
        <div className="border border-dashed border-brand-muted/30 p-8 text-center">
          <p className="text-sm text-brand-muted">
            Aún no tienes proyectos que coincidan con este filtro.
          </p>
        </div>
      ) : (
        <table className="w-full max-w-3xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 font-medium">Número</th>
              <th className="py-2 font-medium">Nombre</th>
              <th className="py-2 font-medium">Cliente</th>
              <th className="py-2 font-medium">Fecha</th>
              <th className="py-2 font-medium">Presupuesto</th>
              <th className="py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-brand-muted/10">
                <td className="py-3">
                  <Link
                    href={`/projects/${p.id}`}
                    className="font-medium text-brand-text hover:text-brand-accent"
                  >
                    {p.number}
                  </Link>
                </td>
                <td className="py-3">{p.name}</td>
                <td className="py-3 text-brand-muted">
                  {(p.clients as { name: string }[] | null)?.[0]?.name ?? "—"}
                </td>
                <td className="py-3 text-brand-muted">{p.event_date || "—"}</td>
                <td className="py-3">{formatMoney(p.budget)}</td>
                <td className="py-3 text-brand-accent">
                  {STATUS_LABELS[p.status] ?? p.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
