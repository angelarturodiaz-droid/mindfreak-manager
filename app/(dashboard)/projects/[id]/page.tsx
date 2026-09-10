import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProject,
  listProjectItems,
  listCompanyMembers,
  listActiveServices,
  getProjectProfitability,
  listProjectQuotations,
  listProjectInvoices,
  listProjectCustomerPayments,
  listProjectExpenses,
  listProjectSuppliers,
  listProjectSupplierPayments,
  listProjectBankTransactions,
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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  TRANSFER: "Transferencia",
  DEPOSIT: "Depósito",
  CHECK: "Cheque",
  CARD: "Tarjeta",
  CASH: "Efectivo",
  OTHER: "Otro",
};

const BANK_TX_TYPE_LABELS: Record<string, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
  TRANSFER: "Transferencia",
};

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "finanzas", label: "Finanzas" },
  { key: "ingresos", label: "Ingresos" },
  { key: "gastos", label: "Gastos" },
  { key: "proveedores", label: "Proveedores" },
  { key: "facturas", label: "Facturas" },
  { key: "cobros", label: "Cobros" },
  { key: "pagos", label: "Pagos" },
  { key: "bancos", label: "Bancos" },
  { key: "tareas", label: "Tareas", phase: "F18" },
  { key: "documentos", label: "Documentos", phase: "F17" },
  { key: "actividades", label: "Actividades", phase: "F18" },
  { key: "rentabilidad", label: "Rentabilidad" },
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
  const quotations = activeTab === "ingresos" ? await listProjectQuotations(id) : null;
  const invoices = activeTab === "facturas" ? await listProjectInvoices(id) : null;
  const customerPayments =
    activeTab === "cobros" ? await listProjectCustomerPayments(id) : null;
  const expenses = activeTab === "gastos" ? await listProjectExpenses(id) : null;
  const projectSuppliers =
    activeTab === "proveedores" ? await listProjectSuppliers(id) : null;
  const supplierPayments =
    activeTab === "pagos" ? await listProjectSupplierPayments(id) : null;
  const bankTransactions =
    activeTab === "bancos" ? await listProjectBankTransactions(id) : null;

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
      ) : activeTab === "ingresos" && quotations ? (
        <div className="max-w-3xl">
          <h2 className="mb-3 text-sm font-medium text-brand-text">
            Cotizaciones del proyecto
          </h2>
          {quotations.length === 0 ? (
            <p className="text-sm text-brand-muted">Sin cotizaciones ligadas.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                  <th className="py-2 font-medium">Número</th>
                  <th className="py-2 font-medium">Fecha</th>
                  <th className="py-2 font-medium">Estado</th>
                  <th className="py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q.id} className="border-b border-brand-muted/10">
                    <td className="py-2">
                      <Link
                        href={`/quotations/${q.id}`}
                        className="text-brand-accent hover:underline"
                      >
                        {q.number}
                      </Link>
                    </td>
                    <td className="py-2 text-brand-muted">{q.issue_date}</td>
                    <td className="py-2 text-brand-muted">{q.status}</td>
                    <td className="py-2 font-medium">
                      {new Intl.NumberFormat("es-DO", {
                        style: "currency",
                        currency: q.currency,
                      }).format(q.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : activeTab === "facturas" && invoices ? (
        <div className="max-w-3xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-brand-text">
              Facturas del proyecto
            </h2>
            <Link href="/invoices/new" className="text-sm text-brand-accent hover:underline">
              Nueva factura
            </Link>
          </div>
          {invoices.length === 0 ? (
            <p className="text-sm text-brand-muted">Sin facturas todavía.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                  <th className="py-2 font-medium">Número</th>
                  <th className="py-2 font-medium">Fecha</th>
                  <th className="py-2 font-medium">Estado</th>
                  <th className="py-2 font-medium">Total</th>
                  <th className="py-2 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-brand-muted/10">
                    <td className="py-2">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="text-brand-accent hover:underline"
                      >
                        {inv.number}
                      </Link>
                    </td>
                    <td className="py-2 text-brand-muted">{inv.issue_date}</td>
                    <td className="py-2 text-brand-muted">{inv.status}</td>
                    <td className="py-2 font-medium">
                      {new Intl.NumberFormat("es-DO", {
                        style: "currency",
                        currency: inv.currency,
                      }).format(inv.total)}
                    </td>
                    <td className="py-2 text-brand-muted">
                      {new Intl.NumberFormat("es-DO", {
                        style: "currency",
                        currency: inv.currency,
                      }).format(inv.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : activeTab === "cobros" && customerPayments ? (
        <div className="max-w-3xl">
          <h2 className="mb-3 text-sm font-medium text-brand-text">
            Cobros del proyecto
          </h2>
          {customerPayments.length === 0 ? (
            <p className="text-sm text-brand-muted">Sin cobros todavía.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                  <th className="py-2 font-medium">Fecha</th>
                  <th className="py-2 font-medium">Factura</th>
                  <th className="py-2 font-medium">Monto</th>
                  <th className="py-2 font-medium">Método</th>
                </tr>
              </thead>
              <tbody>
                {customerPayments.map((p) => {
                  const invoiceData = p.invoices as { number: string }[] | { number: string } | null;
                  const invoiceNumber = Array.isArray(invoiceData)
                    ? invoiceData[0]?.number
                    : invoiceData?.number;
                  return (
                    <tr key={p.id} className="border-b border-brand-muted/10">
                      <td className="py-2">{p.payment_date}</td>
                      <td className="py-2">
                        <Link
                          href={`/invoices/${p.invoice_id}`}
                          className="text-brand-accent hover:underline"
                        >
                          {invoiceNumber ?? "—"}
                        </Link>
                      </td>
                      <td className="py-2 font-medium">
                        {new Intl.NumberFormat("es-DO", {
                          style: "currency",
                          currency: p.currency,
                        }).format(p.amount)}
                      </td>
                      <td className="py-2 text-brand-muted">
                        {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : activeTab === "gastos" && expenses ? (
        <div className="max-w-3xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-brand-text">
              Gastos del proyecto
            </h2>
            <Link href="/expenses/new" className="text-sm text-brand-accent hover:underline">
              Nuevo gasto
            </Link>
          </div>
          {expenses.length === 0 ? (
            <p className="text-sm text-brand-muted">Sin gastos todavía.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                  <th className="py-2 font-medium">Fecha</th>
                  <th className="py-2 font-medium">Descripción</th>
                  <th className="py-2 font-medium">Proveedor</th>
                  <th className="py-2 font-medium">Estado</th>
                  <th className="py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => {
                  const supplierData = e.suppliers as { name: string }[] | { name: string } | null;
                  const supplierName = Array.isArray(supplierData)
                    ? supplierData[0]?.name
                    : supplierData?.name;
                  return (
                    <tr key={e.id} className="border-b border-brand-muted/10">
                      <td className="py-2 text-brand-muted">{e.expense_date}</td>
                      <td className="py-2">
                        <Link
                          href={`/expenses/${e.id}`}
                          className="text-brand-accent hover:underline"
                        >
                          {e.description}
                        </Link>
                      </td>
                      <td className="py-2 text-brand-muted">{supplierName ?? "—"}</td>
                      <td className="py-2 text-brand-muted">{e.status}</td>
                      <td className="py-2 font-medium">
                        {new Intl.NumberFormat("es-DO", {
                          style: "currency",
                          currency: e.currency,
                        }).format(e.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : activeTab === "proveedores" && projectSuppliers ? (
        <div className="max-w-2xl">
          <h2 className="mb-3 text-sm font-medium text-brand-text">
            Proveedores del proyecto
          </h2>
          {projectSuppliers.length === 0 ? (
            <p className="text-sm text-brand-muted">
              Sin proveedores asociados a gastos de este proyecto.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                  <th className="py-2 font-medium">Proveedor</th>
                  <th className="py-2 font-medium">Total gastado</th>
                </tr>
              </thead>
              <tbody>
                {projectSuppliers.map((s) => (
                  <tr key={s.supplierId} className="border-b border-brand-muted/10">
                    <td className="py-2">
                      <Link
                        href={`/suppliers/${s.supplierId}`}
                        className="text-brand-accent hover:underline"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="py-2 font-medium">{formatMoney(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : activeTab === "pagos" && supplierPayments ? (
        <div className="max-w-3xl">
          <h2 className="mb-3 text-sm font-medium text-brand-text">
            Pagos a proveedores del proyecto
          </h2>
          {supplierPayments.length === 0 ? (
            <p className="text-sm text-brand-muted">Sin pagos todavía.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                  <th className="py-2 font-medium">Fecha</th>
                  <th className="py-2 font-medium">Proveedor</th>
                  <th className="py-2 font-medium">Gasto</th>
                  <th className="py-2 font-medium">Monto</th>
                  <th className="py-2 font-medium">Método</th>
                </tr>
              </thead>
              <tbody>
                {supplierPayments.map((p) => {
                  const supplierData = p.suppliers as { name: string }[] | { name: string } | null;
                  const supplierName = Array.isArray(supplierData)
                    ? supplierData[0]?.name
                    : supplierData?.name;
                  return (
                    <tr key={p.id} className="border-b border-brand-muted/10">
                      <td className="py-2 text-brand-muted">{p.payment_date}</td>
                      <td className="py-2">{supplierName ?? "—"}</td>
                      <td className="py-2">
                        <Link
                          href={`/expenses/${p.expense_id}`}
                          className="text-brand-accent hover:underline"
                        >
                          Ver gasto
                        </Link>
                      </td>
                      <td className="py-2 font-medium">
                        {new Intl.NumberFormat("es-DO", {
                          style: "currency",
                          currency: p.currency,
                        }).format(p.amount)}
                      </td>
                      <td className="py-2 text-brand-muted">
                        {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : activeTab === "bancos" && bankTransactions ? (
        <div className="max-w-3xl">
          <h2 className="mb-3 text-sm font-medium text-brand-text">
            Movimientos bancarios del proyecto
          </h2>
          {bankTransactions.length === 0 ? (
            <p className="text-sm text-brand-muted">Sin movimientos todavía.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                  <th className="py-2 font-medium">Fecha</th>
                  <th className="py-2 font-medium">Cuenta</th>
                  <th className="py-2 font-medium">Tipo</th>
                  <th className="py-2 font-medium">Descripción</th>
                  <th className="py-2 font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {bankTransactions.map((t) => {
                  const accountData = t.bank_accounts as { name: string }[] | { name: string } | null;
                  const accountName = Array.isArray(accountData)
                    ? accountData[0]?.name
                    : accountData?.name;
                  return (
                    <tr key={t.id} className="border-b border-brand-muted/10">
                      <td className="py-2 text-brand-muted">{t.transaction_date}</td>
                      <td className="py-2">{accountName ?? "—"}</td>
                      <td className="py-2 text-brand-muted">
                        {BANK_TX_TYPE_LABELS[t.type] ?? t.type}
                      </td>
                      <td className="py-2">{t.description ?? "—"}</td>
                      <td
                        className={
                          t.amount < 0
                            ? "py-2 font-medium text-brand-danger"
                            : "py-2 font-medium"
                        }
                      >
                        {new Intl.NumberFormat("es-DO", {
                          style: "currency",
                          currency: t.currency,
                        }).format(t.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
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
