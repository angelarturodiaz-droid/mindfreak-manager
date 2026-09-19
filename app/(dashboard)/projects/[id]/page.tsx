import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
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
import { DocumentList } from "@/components/documents/document-list";
import { UploadDocumentForm } from "@/components/documents/upload-document-form";
import { listDocuments } from "@/features/documents/queries";
import { listTasks } from "@/features/tasks/queries";
import { NewTaskForm } from "@/components/tasks/new-task-form";
import { TaskList } from "@/components/tasks/task-list";
import { listProjectActivities } from "@/features/activities/queries";
import { NewActivityForm } from "./new-activity-form";
import { ActivityItem } from "./activity-item";
import { updateProjectStatusAction, deleteProjectItemAction } from "@/features/projects/actions";
import { hasPermission } from "@/lib/auth/permissions";
import { ProjectEditForm } from "./project-edit-form";
import { NewProjectItemForm } from "./new-item-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, KpiCard } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable, type Column } from "@/components/ui/data-table";

const STATUS_LABELS: Record<string, string> = {
  PLANNING: "Planificación",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

const QUOTATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  VIEWED: "Vista",
  NEGOTIATING: "Negociando",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitida",
  PARTIALLY_PAID: "Pago parcial",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

const EXPENSE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIALLY_PAID: "Pago parcial",
  PAID: "Pagado",
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
  { key: "tareas", label: "Tareas" },
  { key: "documentos", label: "Documentos" },
  { key: "actividades", label: "Actividades" },
  { key: "rentabilidad", label: "Rentabilidad" },
];

function formatMoney(amount: number, currency = "DOP") {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

type ProjectItemRow = Awaited<ReturnType<typeof listProjectItems>>[number];
type QuotationRow = Awaited<ReturnType<typeof listProjectQuotations>>[number];
type InvoiceRow = Awaited<ReturnType<typeof listProjectInvoices>>[number];
type PaymentRow = Awaited<ReturnType<typeof listProjectCustomerPayments>>[number];
type ExpenseRow = Awaited<ReturnType<typeof listProjectExpenses>>[number];
type SupplierRow = Awaited<ReturnType<typeof listProjectSuppliers>>[number];
type SupplierPaymentRow = Awaited<ReturnType<typeof listProjectSupplierPayments>>[number];
type BankTxRow = Awaited<ReturnType<typeof listProjectBankTransactions>>[number];

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
  const documents = activeTab === "documentos" ? await listDocuments("project", id) : null;
  const canManageDocs =
    activeTab === "documentos" ? await hasPermission("documents.upload") : false;
  const projectTasks = activeTab === "tareas" ? await listTasks({ projectId: id }) : null;
  const projectActivities =
    activeTab === "actividades" ? await listProjectActivities(id) : null;

  const clientData = project.clients as { name: string } | { name: string }[] | null;
  const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;
  const quotationData = project.quotations as { number: string } | { number: string }[] | null;
  const quotationNumber = Array.isArray(quotationData)
    ? quotationData[0]?.number
    : quotationData?.number;

  const estimatedCostTotal = items.reduce((sum, i) => sum + i.estimated_cost, 0);

  const itemColumns: Column<ProjectItemRow>[] = [
    { header: "Descripción", accessor: (i) => i.description },
    { header: "Cant.", accessor: (i) => i.quantity },
    { header: "Precio", accessor: (i) => formatMoney(i.unit_price) },
    { header: "Costo est.", accessor: (i) => <span className="text-brand-muted">{formatMoney(i.estimated_cost)}</span> },
    { header: "Subtotal", accessor: (i) => <span className="font-medium">{formatMoney(i.subtotal)}</span> },
    {
      header: "",
      className: "text-right",
      accessor: (i) =>
        canUpdate ? (
          <ConfirmButton
            label="Eliminar"
            confirmTitle="¿Eliminar esta línea?"
            onConfirm={deleteProjectItemAction.bind(null, i.id, project.id)}
          />
        ) : null,
    },
  ];

  const quotationColumns: Column<QuotationRow>[] = [
    {
      header: "Número",
      accessor: (q) => (
        <Link href={`/quotations/${q.id}`} className="text-brand-accent hover:underline">
          {q.number}
        </Link>
      ),
    },
    { header: "Fecha", accessor: (q) => <span className="text-brand-muted">{q.issue_date}</span> },
    { header: "Estado", accessor: (q) => <Badge status={q.status}>{QUOTATION_STATUS_LABELS[q.status] ?? q.status}</Badge> },
    { header: "Total", accessor: (q) => <span className="font-medium">{formatMoney(q.total, q.currency)}</span> },
  ];

  const invoiceColumns: Column<InvoiceRow>[] = [
    {
      header: "Número",
      accessor: (inv) => (
        <Link href={`/invoices/${inv.id}`} className="text-brand-accent hover:underline">
          {inv.number}
        </Link>
      ),
    },
    { header: "Fecha", accessor: (inv) => <span className="text-brand-muted">{inv.issue_date}</span> },
    { header: "Estado", accessor: (inv) => <Badge status={inv.status}>{INVOICE_STATUS_LABELS[inv.status] ?? inv.status}</Badge> },
    { header: "Total", accessor: (inv) => <span className="font-medium">{formatMoney(inv.total, inv.currency)}</span> },
    { header: "Balance", accessor: (inv) => <span className="text-brand-muted">{formatMoney(inv.balance, inv.currency)}</span> },
  ];

  const paymentColumns: Column<PaymentRow>[] = [
    { header: "Fecha", accessor: (p) => p.payment_date },
    {
      header: "Factura",
      accessor: (p) => {
        const invoiceData = p.invoices as { number: string }[] | { number: string } | null;
        const invoiceNumber = Array.isArray(invoiceData) ? invoiceData[0]?.number : invoiceData?.number;
        return (
          <Link href={`/invoices/${p.invoice_id}`} className="text-brand-accent hover:underline">
            {invoiceNumber ?? "—"}
          </Link>
        );
      },
    },
    { header: "Monto", accessor: (p) => <span className="font-medium">{formatMoney(p.amount, p.currency)}</span> },
    { header: "Método", accessor: (p) => <span className="text-brand-muted">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span> },
  ];

  const expenseColumns: Column<ExpenseRow>[] = [
    { header: "Fecha", accessor: (e) => <span className="text-brand-muted">{e.expense_date}</span> },
    {
      header: "Descripción",
      accessor: (e) => (
        <Link href={`/expenses/${e.id}`} className="text-brand-accent hover:underline">
          {e.description}
        </Link>
      ),
    },
    {
      header: "Proveedor",
      accessor: (e) => {
        const supplierData = e.suppliers as { name: string }[] | { name: string } | null;
        const supplierName = Array.isArray(supplierData) ? supplierData[0]?.name : supplierData?.name;
        return <span className="text-brand-muted">{supplierName ?? "—"}</span>;
      },
    },
    { header: "Estado", accessor: (e) => <Badge status={e.status}>{EXPENSE_STATUS_LABELS[e.status] ?? e.status}</Badge> },
    { header: "Total", accessor: (e) => <span className="font-medium">{formatMoney(e.total, e.currency)}</span> },
  ];

  const supplierColumns: Column<SupplierRow>[] = [
    {
      header: "Proveedor",
      accessor: (s) => (
        <Link href={`/suppliers/${s.supplierId}`} className="text-brand-accent hover:underline">
          {s.name}
        </Link>
      ),
    },
    { header: "Total gastado", accessor: (s) => <span className="font-medium">{formatMoney(s.total)}</span> },
  ];

  const supplierPaymentColumns: Column<SupplierPaymentRow>[] = [
    { header: "Fecha", accessor: (p) => <span className="text-brand-muted">{p.payment_date}</span> },
    {
      header: "Proveedor",
      accessor: (p) => {
        const supplierData = p.suppliers as { name: string }[] | { name: string } | null;
        const supplierName = Array.isArray(supplierData) ? supplierData[0]?.name : supplierData?.name;
        return supplierName ?? "—";
      },
    },
    {
      header: "Gasto",
      accessor: (p) => (
        <Link href={`/expenses/${p.expense_id}`} className="text-brand-accent hover:underline">
          Ver gasto
        </Link>
      ),
    },
    { header: "Monto", accessor: (p) => <span className="font-medium">{formatMoney(p.amount, p.currency)}</span> },
    { header: "Método", accessor: (p) => <span className="text-brand-muted">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span> },
  ];

  const bankColumns: Column<BankTxRow>[] = [
    { header: "Fecha", accessor: (t) => <span className="text-brand-muted">{t.transaction_date}</span> },
    {
      header: "Cuenta",
      accessor: (t) => {
        const accountData = t.bank_accounts as { name: string }[] | { name: string } | null;
        const accountName = Array.isArray(accountData) ? accountData[0]?.name : accountData?.name;
        return accountName ?? "—";
      },
    },
    { header: "Tipo", accessor: (t) => <span className="text-brand-muted">{BANK_TX_TYPE_LABELS[t.type] ?? t.type}</span> },
    { header: "Descripción", accessor: (t) => t.description ?? "—" },
    {
      header: "Monto",
      accessor: (t) => (
        <span className={t.amount < 0 ? "font-medium text-brand-danger" : "font-medium"}>
          {formatMoney(t.amount, t.currency)}
        </span>
      ),
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
        >
          <ArrowLeft size={14} /> Proyectos
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-brand-primary">
            {project.number} — {project.name}
          </h1>
          <Badge status={project.status}>{STATUS_LABELS[project.status] ?? project.status}</Badge>
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
              <Button
                type="submit"
                variant={project.status === status ? "secondary" : "outline"}
                size="sm"
                disabled={project.status === status}
              >
                {label}
              </Button>
            </form>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-brand-border">
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
            <Card>
              <ProjectEditForm project={project} members={members} />
            </Card>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-brand-text">
              Líneas del proyecto
            </h2>
            <DataTable columns={itemColumns} rows={items} keyFor={(i) => i.id} maxWidth="max-w-3xl" emptyMessage="Sin líneas todavía." />

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
        <div className="max-w-3xl">
          <h2 className="mb-3 text-sm font-medium text-brand-text">
            Resumen financiero
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <KpiCard label="Cotizado" value={formatMoney(profitability.cotizado)} />
            <KpiCard label="Facturado" value={formatMoney(profitability.facturado)} />
            <KpiCard label="Cobrado" value={formatMoney(profitability.cobrado)} />
            <KpiCard label="Costo estimado" value={formatMoney(profitability.costoEstimado)} />
            <KpiCard label="Costo real" value={formatMoney(profitability.costoReal)} />
            <KpiCard
              label="Presupuesto"
              value={formatMoney(profitability.presupuesto)}
              trend={
                profitability.presupuestoConsumidoPct !== null
                  ? `${formatPercent(profitability.presupuestoConsumidoPct)} consumido`
                  : undefined
              }
            />
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
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              label="Utilidad estimada"
              value={formatMoney(profitability.utilidadEstimada)}
              danger={profitability.utilidadEstimada < 0}
            />
            <KpiCard
              label="Utilidad real"
              value={formatMoney(profitability.utilidadReal)}
              danger={profitability.utilidadReal < 0}
            />
          </div>
          <p className="mt-2 text-xs text-brand-muted">
            Margen estimado: {formatPercent(profitability.margenEstimado)} · Margen
            real: {formatPercent(profitability.margenReal)}
          </p>
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
          <DataTable columns={quotationColumns} rows={quotations} keyFor={(q) => q.id} emptyMessage="Sin cotizaciones ligadas." maxWidth="max-w-3xl" />
        </div>
      ) : activeTab === "facturas" && invoices ? (
        <div className="max-w-3xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-brand-text">
              Facturas del proyecto
            </h2>
            <Link href="/invoices/new">
              <Button variant="ghost" size="sm" icon={<Plus size={14} />}>
                Nueva factura
              </Button>
            </Link>
          </div>
          <DataTable columns={invoiceColumns} rows={invoices} keyFor={(i) => i.id} emptyMessage="Sin facturas todavía." maxWidth="max-w-3xl" />
        </div>
      ) : activeTab === "cobros" && customerPayments ? (
        <div className="max-w-3xl">
          <h2 className="mb-3 text-sm font-medium text-brand-text">
            Cobros del proyecto
          </h2>
          <DataTable columns={paymentColumns} rows={customerPayments} keyFor={(p) => p.id} emptyMessage="Sin cobros todavía." maxWidth="max-w-3xl" />
        </div>
      ) : activeTab === "gastos" && expenses ? (
        <div className="max-w-3xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-brand-text">
              Gastos del proyecto
            </h2>
            <Link href="/expenses/new">
              <Button variant="ghost" size="sm" icon={<Plus size={14} />}>
                Nuevo gasto
              </Button>
            </Link>
          </div>
          <DataTable columns={expenseColumns} rows={expenses} keyFor={(e) => e.id} emptyMessage="Sin gastos todavía." maxWidth="max-w-3xl" />
        </div>
      ) : activeTab === "proveedores" && projectSuppliers ? (
        <div className="max-w-2xl">
          <h2 className="mb-3 text-sm font-medium text-brand-text">
            Proveedores del proyecto
          </h2>
          <DataTable
            columns={supplierColumns}
            rows={projectSuppliers}
            keyFor={(s) => s.supplierId}
            emptyMessage="Sin proveedores asociados a gastos de este proyecto."
            maxWidth="max-w-2xl"
          />
        </div>
      ) : activeTab === "pagos" && supplierPayments ? (
        <div className="max-w-3xl">
          <h2 className="mb-3 text-sm font-medium text-brand-text">
            Pagos a proveedores del proyecto
          </h2>
          <DataTable
            columns={supplierPaymentColumns}
            rows={supplierPayments}
            keyFor={(p) => p.id}
            emptyMessage="Sin pagos todavía."
            maxWidth="max-w-3xl"
          />
        </div>
      ) : activeTab === "bancos" && bankTransactions ? (
        <div className="max-w-3xl">
          <h2 className="mb-3 text-sm font-medium text-brand-text">
            Movimientos bancarios del proyecto
          </h2>
          <DataTable columns={bankColumns} rows={bankTransactions} keyFor={(t) => t.id} emptyMessage="Sin movimientos todavía." maxWidth="max-w-3xl" />
        </div>
      ) : activeTab === "documentos" && documents ? (
        <div className="flex max-w-2xl flex-col gap-4">
          <h2 className="text-sm font-medium text-brand-text">
            Documentos del proyecto
          </h2>
          {canManageDocs && (
            <UploadDocumentForm
              entityType="project"
              entityId={id}
              revalidatePathValue={`/projects/${id}?tab=documentos`}
            />
          )}
          <DocumentList
            documents={documents}
            canDelete={canManageDocs}
            revalidatePathValue={`/projects/${id}?tab=documentos`}
          />
        </div>
      ) : activeTab === "tareas" && projectTasks ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-brand-text">
            Tareas del proyecto
          </h2>
          {canUpdate && (
            <NewTaskForm
              members={members}
              defaultProjectId={id}
              revalidatePathValue={`/projects/${id}?tab=tareas`}
            />
          )}
          <TaskList
            tasks={projectTasks}
            showProjectColumn={false}
            revalidatePathValue={`/projects/${id}?tab=tareas`}
          />
        </div>
      ) : activeTab === "actividades" && projectActivities ? (
        <div className="flex max-w-2xl flex-col gap-4">
          <h2 className="text-sm font-medium text-brand-text">
            Actividades del proyecto
          </h2>
          {canUpdate && (
            <NewActivityForm
              projectId={id}
              revalidatePathValue={`/projects/${id}?tab=actividades`}
            />
          )}
          {projectActivities.length === 0 ? (
            <p className="text-sm text-brand-muted">Sin actividades todavía.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {projectActivities.map((a) => (
                <ActivityItem
                  key={a.id}
                  activity={a}
                  revalidatePathValue={`/projects/${id}?tab=actividades`}
                />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="border border-dashed border-brand-border p-8 text-center">
          <p className="text-sm text-brand-muted">Pestaña no encontrada.</p>
        </div>
      )}
    </main>
  );
}
