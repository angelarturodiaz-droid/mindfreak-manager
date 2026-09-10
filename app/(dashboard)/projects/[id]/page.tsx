import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProject,
  listProjectItems,
  listCompanyMembers,
  listActiveServices,
  getProjectProfitability,
} from "@/features/projects/queries";
import { updateProjectStatusAction, deleteProjectItemAction } from "@/features/projects/actions";
import { hasPermission } from "@/lib/auth/permissions";
import { ProjectEditForm } from "./project-edit-form";
import { NewProjectItemForm } from "./new-item-form";

const STATUS_LABELS: Record<string, string> = {
  PLANNING: "Planificación",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "finanzas", label: "Finanzas", phase: "F15" },
  { key: "ingresos", label: "Ingresos", phase: "F10/F11" },
  { key: "gastos", label: "Gastos", phase: "F12" },
  { key: "proveedores", label: "Proveedores", phase: "F13" },
  { key: "facturas", label: "Facturas", phase: "F10" },
  { key: "cobros", label: "Cobros", phase: "F11" },
  { key: "pagos", label: "Pagos", phase: "F13" },
  { key: "bancos", label: "Bancos", phase: "F14" },
  { key: "tareas", label: "Tareas", phase: "F18" },
  { key: "documentos", label: "Documentos", phase: "F17" },
  { key: "actividades", label: "Actividades", phase: "F18" },
  { key: "rentabilidad", label: "Rentabilidad", phase: "F15" },
];

function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(
    amount,
  );
}

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = tab ?? "resumen";

  let project;
  try {
    project = await getProject(id);
  } catch {
    notFound();
  }
  if (!project) notFound();

  const [items, members, services, canUpdate] = await Promise.all([
    listProjectItems(id),
    listCompanyMembers(),
    listActiveServices(),
    hasPermission("projects.update"),
  ]);

  const profitability =
    activeTab === "finanzas" || activeTab === "rentabilidad"
      ? await getProjectProfitability(id)
      : null;

  const clientData = project.clients as { name: string } | { name: string }[] | null;
  const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;
  const quotationData = project.quotations as { number: string } | { number: string }[] | null;
  const quotationNumber = Array.isArray(quotationData)
    ? quotationData[0]?.number
    : quotationData?.number;

  const estimatedCostTotal = items.reduce((sum, i) => sum + i.estimated_cost, 0);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/projects" className="text-sm text-brand-muted hover:text-brand-text">
          ← Proyectos
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-brand-primary">
            {project.number} — {project.name}
          </h1>
          <span className="text-brand-accent">
            {STATUS_LABELS[project.status] ?? project.status}
          </span>
        </div>
        <p className="text-sm text-brand-muted">
          Cliente: {clientName ?? "—"}
          {quotationNumber && ` · Desde cotización ${quotationNumber}`}
          {project.event_date && ` · Evento: ${project.event_date}`}
        </p>
      </div>

      {canUpdate && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <form key={status} action={updateProjectStatusAction.bind(null, project.id, status)}>
              <button
                type="submit"
                disabled={project.status === status}
                className={
                  project.status === status
                    ? "border border-brand-accent bg-brand-accent px-3 py-1.5 text-xs text-white"
                    : "border border-brand-muted/30 px-3 py-1.5 text-xs text-brand-text hover:border-brand-accent"
                }
              >
                {label}
              </button>
            </form>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-brand-muted/20">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/projects/${id}?tab=${t.key}`}
            className={
              activeTab === t.key
                ? "border-b-2 border-brand-accent px-3 py-2 text-sm font-medium text-brand-accent"
                : "px-3 py-2 text-sm text-brand-muted hover:text-brand-text"
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === "resumen" ? (
        <div className="flex flex-col gap-8">
          <section className="max-w-md">
            <h2 className="mb-3 text-sm font-medium text-brand-text">
              Información general
            </h2>
            <ProjectEditForm project={project} members={members} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-brand-text">
              Líneas del proyecto
            </h2>
            <table className="w-full max-w-3xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                  <th className="py-2 font-medium">Descripción</th>
                  <th className="py-2 font-medium">Cant.</th>
                  <th className="py-2 font-medium">Precio</th>
                  <th className="py-2 font-medium">Costo est.</th>
                  <th className="py-2 font-medium">Subtotal</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-brand-muted/10">
                    <td className="py-2">{item.description}</td>
                    <td className="py-2">{item.quantity}</td>
                    <td className="py-2">{formatMoney(item.unit_price)}</td>
                    <td className="py-2 text-brand-muted">
                      {formatMoney(item.estimated_cost)}
                    </td>
                    <td className="py-2 font-medium">{formatMoney(item.subtotal)}</td>
                    <td className="py-2 text-right">
                      {canUpdate && (
                        <form
                          action={deleteProjectItemAction.bind(null, item.id, project.id)}
                        >
                          <button
                            type="submit"
                            className="text-brand-muted hover:text-brand-danger"
                          >
                            Eliminar
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-brand-muted">
                      Sin líneas todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canUpdate && (
              <div className="mt-4">
                <NewProjectItemForm projectId={project.id} services={services} />
              </div>
            )}

            <div className="mt-4 max-w-3xl text-sm">
              <p>
                Presupuesto:{" "}
                <span className="font-medium">{formatMoney(project.budget)}</span>
                {" · "}
                Costo estimado de líneas:{" "}
                <span className="font-medium">{formatMoney(estimatedCostTotal)}</span>
                {project.budget > 0 && (
                  <span className="text-brand-muted">
                    {" "}
                    ({((estimatedCostTotal / project.budget) * 100).toFixed(0)}%
                    consumido)
                  </span>
                )}
              </p>
            </div>
          </section>
        </div>
      ) : activeTab === "finanzas" && profitability ? (
        <div className="max-w-2xl">
          <h2 className="mb-3 text-sm font-medium text-brand-text">
            Resumen financiero
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="border border-brand-muted/20 px-4 py-3">
              <p className="text-xs text-brand-muted">Cotizado</p>
              <p className="font-medium">{formatMoney(profitability.cotizado)}</p>
            </div>
            <div className="border border-brand-muted/20 px-4 py-3">
              <p className="text-xs text-brand-muted">Facturado</p>
              <p className="font-medium">{formatMoney(profitability.facturado)}</p>
            </div>
            <div className="border border-brand-muted/20 px-4 py-3">
              <p className="text-xs text-brand-muted">Cobrado</p>
              <p className="font-medium">{formatMoney(profitability.cobrado)}</p>
            </div>
            <div className="border border-brand-muted/20 px-4 py-3">
              <p className="text-xs text-brand-muted">Costo estimado</p>
              <p className="font-medium">{formatMoney(profitability.costoEstimado)}</p>
            </div>
            <div className="border border-brand-muted/20 px-4 py-3">
              <p className="text-xs text-brand-muted">Costo real</p>
              <p className="font-medium">{formatMoney(profitability.costoReal)}</p>
            </div>
            <div className="border border-brand-muted/20 px-4 py-3">
              <p className="text-xs text-brand-muted">Presupuesto</p>
              <p className="font-medium">{formatMoney(profitability.presupuesto)}</p>
              {profitability.presupuestoConsumidoPct !== null && (
                <p className="text-xs text-brand-muted">
                  {formatPercent(profitability.presupuestoConsumidoPct)} consumido
                </p>
              )}
            </div>
          </div>
          <p className="mt-4 text-xs text-brand-muted">
            Todos los montos se consolidan en la moneda base de la empresa,
            usando la tasa de cambio ya congelada de cada factura/gasto/cobro
            (nunca la tasa actual).
          </p>
        </div>
      ) : activeTab === "rentabilidad" && profitability ? (
        <div className="max-w-2xl">
          <h2 className="mb-3 text-sm font-medium text-brand-text">
            Rentabilidad
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="border border-brand-muted/20 px-4 py-3">
              <p className="text-xs text-brand-muted">Utilidad estimada</p>
              <p
                className={
                  profitability.utilidadEstimada < 0
                    ? "font-medium text-brand-danger"
                    : "font-medium"
                }
              >
                {formatMoney(profitability.utilidadEstimada)}
              </p>
              <p className="text-xs text-brand-muted">
                Margen: {formatPercent(profitability.margenEstimado)}
              </p>
            </div>
            <div className="border border-brand-muted/20 px-4 py-3">
              <p className="text-xs text-brand-muted">Utilidad real</p>
              <p
                className={
                  profitability.utilidadReal < 0
                    ? "font-medium text-brand-danger"
                    : "font-medium"
                }
              >
                {formatMoney(profitability.utilidadReal)}
              </p>
              <p className="text-xs text-brand-muted">
                Margen: {formatPercent(profitability.margenReal)}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-brand-muted">
            Utilidad estimada = Cotizado − Costo estimado · Utilidad real =
            Facturado − Costo real.
          </p>
        </div>
      ) : (
        <div className="border border-dashed border-brand-muted/30 p-8 text-center">
          <p className="text-sm text-brand-muted">
            Esta pestaña se construye en{" "}
            {TABS.find((t) => t.key === activeTab)?.phase} — todavía no existe
            ese módulo.
          </p>
        </div>
      )}
    </main>
  );
}
