import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckSquare,
  Check,
  Clock,
  FileText,
  FolderOpen,
  Landmark,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Plus,
  Receipt,
  RotateCcw,
  ShoppingCart,
  TrendingUp,
  UserRound,
  XCircle,
} from "lucide-react";
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
import {
  COUNTDOWN_CLASSES,
  PROJECT_FLOW,
  PROJECT_STATUS_LABELS,
  eventCountdown,
  formatEventDate,
  formatEventTime,
  formatMoney,
} from "@/features/projects/display";
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
import { relationName, relationRow } from "@/lib/utils/relation";
import { ProjectEditForm } from "./project-edit-form";
import { NewProjectItemForm } from "./new-item-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, KpiCard } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DataTable, type Column } from "@/components/ui/data-table";

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

/**
 * Pestañas agrupadas: antes eran 13 (Ingresos, Facturas, Cobros, Gastos,
 * Proveedores, Pagos, Rentabilidad… por separado). Ahora se agrupan por
 * lo que el usuario quiere ver: lo que se le cobra al cliente (Ventas), lo
 * que se le paga a proveedores (Compras) y los números (Finanzas).
 */
const TABS = [
  { key: "resumen", label: "Resumen", icon: LayoutDashboard },
  { key: "finanzas", label: "Finanzas", icon: TrendingUp },
  { key: "ventas", label: "Ventas y cobros", icon: Receipt },
  { key: "compras", label: "Gastos y proveedores", icon: ShoppingCart },
  { key: "bancos", label: "Bancos", icon: Landmark },
  { key: "tareas", label: "Tareas", icon: CheckSquare },
  { key: "documentos", label: "Documentos", icon: FolderOpen },
  { key: "actividades", label: "Actividades", icon: MessageSquare },
] as const;

/** Enlaces viejos (?tab=facturas, ?tab=gastos…) siguen funcionando. */
const TAB_ALIASES: Record<string, string> = {
  ingresos: "ventas",
  facturas: "ventas",
  cobros: "ventas",
  gastos: "compras",
  proveedores: "compras",
  pagos: "compras",
  rentabilidad: "finanzas",
};

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

function SectionHeader({
  title,
  description,
  count,
  action,
}: {
  title: string;
  description?: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-brand-text">
          {title}
          {count !== undefined && (
            <span className="rounded-full bg-brand-surface-hover px-2 py-0.5 text-xs font-medium tabular-nums text-brand-muted">
              {count}
            </span>
          )}
        </h2>
        {description && <p className="text-sm text-brand-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function ProgressBar({ pct, danger }: { pct: number; danger?: boolean }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-surface-hover">
      <div
        className={`h-full rounded-full ${danger ? "bg-brand-danger" : "bg-brand-accent"}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  pct,
  danger,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  pct?: number | null;
  danger?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <p className="text-sm font-medium text-brand-muted">{label}</p>
      <p
        className={`text-xl font-semibold tracking-tight tabular-nums ${danger ? "text-brand-danger" : "text-brand-text"}`}
      >
        {value}
      </p>
      {pct !== undefined && pct !== null && <ProgressBar pct={pct} danger={danger || pct > 100} />}
      {hint && <p className="text-xs text-brand-muted">{hint}</p>}
    </Card>
  );
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
  const requestedTab = tab ?? "resumen";
  const activeTab = TAB_ALIASES[requestedTab] ?? requestedTab;

  let project;
  try {
    project = await getProject(id);
  } catch {
    notFound();
  }
  if (!project) notFound();

  const [items, members, services, canUpdate, profitability] = await Promise.all([
    listProjectItems(id),
    listCompanyMembers(),
    listActiveServices(),
    hasPermission("projects.update"),
    getProjectProfitability(id),
  ]);

  const isVentas = activeTab === "ventas";
  const isCompras = activeTab === "compras";
  const [
    quotations,
    invoices,
    customerPayments,
    expenses,
    projectSuppliers,
    supplierPayments,
    bankTransactions,
    documents,
    canManageDocs,
    projectTasks,
    projectActivities,
  ] = await Promise.all([
    isVentas ? listProjectQuotations(id) : null,
    isVentas ? listProjectInvoices(id) : null,
    isVentas ? listProjectCustomerPayments(id) : null,
    isCompras ? listProjectExpenses(id) : null,
    isCompras ? listProjectSuppliers(id) : null,
    isCompras ? listProjectSupplierPayments(id) : null,
    activeTab === "bancos" ? listProjectBankTransactions(id) : null,
    activeTab === "documentos" ? listDocuments("project", id) : null,
    activeTab === "documentos" ? hasPermission("documents.upload") : false,
    activeTab === "tareas" ? listTasks({ projectId: id }) : null,
    activeTab === "actividades" ? listProjectActivities(id) : null,
  ]);

  const clientName = relationName(project.clients);
  const quotationNumber = relationRow<{ number: string }>(project.quotations)?.number;
  const manager = members.find((m) => m.id === project.manager_id);
  const managerName = manager ? manager.full_name || manager.email : null;
  const countdown = eventCountdown(project.event_date, project.status);
  const eventTime = formatEventTime(project.event_time);
  const isCancelled = project.status === "CANCELLED";
  const currentStep = PROJECT_FLOW.indexOf(project.status as (typeof PROJECT_FLOW)[number]);

  const linesTotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  const estimatedCostTotal = items.reduce((sum, i) => sum + i.estimated_cost, 0);
  const estimatedMargin = linesTotal > 0 ? ((linesTotal - estimatedCostTotal) / linesTotal) * 100 : null;
  const porCobrar = Math.max(0, profitability.facturado - profitability.cobrado);

  const itemColumns: Column<ProjectItemRow>[] = [
    { header: "Descripción", accessor: (i) => <span className="text-brand-text">{i.description}</span> },
    { header: "Cant.", className: "text-right", accessor: (i) => <span className="tabular-nums">{i.quantity}</span> },
    { header: "Precio", className: "text-right", accessor: (i) => <span className="tabular-nums">{formatMoney(i.unit_price)}</span> },
    {
      header: "Costo est.",
      className: "text-right",
      accessor: (i) => <span className="tabular-nums text-brand-muted">{formatMoney(i.estimated_cost)}</span>,
    },
    {
      header: "Subtotal",
      className: "text-right",
      accessor: (i) => <span className="font-medium tabular-nums">{formatMoney(i.subtotal)}</span>,
    },
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
        <Link href={`/quotations/${q.id}`} className="font-medium text-brand-accent hover:underline">
          {q.number}
        </Link>
      ),
    },
    { header: "Fecha", accessor: (q) => <span className="text-brand-muted">{q.issue_date}</span> },
    { header: "Estado", accessor: (q) => <Badge status={q.status}>{QUOTATION_STATUS_LABELS[q.status] ?? q.status}</Badge> },
    {
      header: "Total",
      className: "text-right",
      accessor: (q) => <span className="font-medium tabular-nums">{formatMoney(q.total, q.currency)}</span>,
    },
  ];

  const invoiceColumns: Column<InvoiceRow>[] = [
    {
      header: "Número",
      accessor: (inv) => (
        <Link href={`/invoices/${inv.id}`} className="font-medium text-brand-accent hover:underline">
          {inv.number}
        </Link>
      ),
    },
    { header: "Fecha", accessor: (inv) => <span className="text-brand-muted">{inv.issue_date}</span> },
    { header: "Estado", accessor: (inv) => <Badge status={inv.status}>{INVOICE_STATUS_LABELS[inv.status] ?? inv.status}</Badge> },
    {
      header: "Total",
      className: "text-right",
      accessor: (inv) => <span className="font-medium tabular-nums">{formatMoney(inv.total, inv.currency)}</span>,
    },
    {
      header: "Balance",
      className: "text-right",
      accessor: (inv) => (
        <span className={`tabular-nums ${inv.balance > 0 ? "text-brand-warning" : "text-brand-muted"}`}>
          {formatMoney(inv.balance, inv.currency)}
        </span>
      ),
    },
  ];

  const paymentColumns: Column<PaymentRow>[] = [
    { header: "Fecha", accessor: (p) => <span className="text-brand-muted">{p.payment_date}</span> },
    {
      header: "Factura",
      accessor: (p) => (
        <Link href={`/invoices/${p.invoice_id}`} className="text-brand-accent hover:underline">
          {relationRow<{ number: string }>(p.invoices)?.number ?? "—"}
        </Link>
      ),
    },
    { header: "Método", accessor: (p) => <span className="text-brand-muted">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span> },
    {
      header: "Monto",
      className: "text-right",
      accessor: (p) => <span className="font-medium tabular-nums text-brand-success">{formatMoney(p.amount, p.currency)}</span>,
    },
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
    { header: "Proveedor", accessor: (e) => <span className="text-brand-muted">{relationName(e.suppliers) ?? "—"}</span> },
    { header: "Estado", accessor: (e) => <Badge status={e.status}>{EXPENSE_STATUS_LABELS[e.status] ?? e.status}</Badge> },
    {
      header: "Total",
      className: "text-right",
      accessor: (e) => <span className="font-medium tabular-nums">{formatMoney(e.total, e.currency)}</span>,
    },
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
    {
      header: "Total gastado",
      className: "text-right",
      accessor: (s) => <span className="font-medium tabular-nums">{formatMoney(s.total)}</span>,
    },
  ];

  const supplierPaymentColumns: Column<SupplierPaymentRow>[] = [
    { header: "Fecha", accessor: (p) => <span className="text-brand-muted">{p.payment_date}</span> },
    { header: "Proveedor", accessor: (p) => relationName(p.suppliers) ?? "—" },
    {
      header: "Gasto",
      accessor: (p) => (
        <Link href={`/expenses/${p.expense_id}`} className="text-brand-accent hover:underline">
          Ver gasto
        </Link>
      ),
    },
    { header: "Método", accessor: (p) => <span className="text-brand-muted">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span> },
    {
      header: "Monto",
      className: "text-right",
      accessor: (p) => <span className="font-medium tabular-nums">{formatMoney(p.amount, p.currency)}</span>,
    },
  ];

  const bankColumns: Column<BankTxRow>[] = [
    { header: "Fecha", accessor: (t) => <span className="text-brand-muted">{t.transaction_date}</span> },
    { header: "Cuenta", accessor: (t) => relationName(t.bank_accounts) ?? "—" },
    { header: "Tipo", accessor: (t) => <span className="text-brand-muted">{BANK_TX_TYPE_LABELS[t.type] ?? t.type}</span> },
    { header: "Descripción", accessor: (t) => t.description ?? "—" },
    {
      header: "Monto",
      className: "text-right",
      accessor: (t) => (
        <span className={`font-medium tabular-nums ${t.amount < 0 ? "text-brand-danger" : "text-brand-success"}`}>
          {formatMoney(t.amount, t.currency)}
        </span>
      ),
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link
        href="/projects"
        className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
      >
        <ArrowLeft size={14} /> Proyectos
      </Link>

      {/* Encabezado: qué evento es, de quién, cuándo y dónde */}
      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-brand-muted">
              <span className="font-medium">{project.number}</span>
              <Badge status={project.status}>
                {PROJECT_STATUS_LABELS[project.status] ?? project.status}
              </Badge>
              {countdown && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${COUNTDOWN_CLASSES[countdown.tone]}`}
                >
                  {countdown.label}
                </span>
              )}
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-brand-primary">
              {project.name}
            </h1>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-1.5">
                <Building2 size={15} className="text-brand-muted" aria-hidden />
                <dt className="sr-only">Cliente</dt>
                <dd>
                  <Link href={`/clients/${project.client_id}`} className="text-brand-text hover:text-brand-accent">
                    {clientName ?? "Sin cliente"}
                  </Link>
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <CalendarDays size={15} className="text-brand-muted" aria-hidden />
                <dt className="sr-only">Fecha del evento</dt>
                <dd className={project.event_date ? "text-brand-text" : "text-brand-muted"}>
                  {project.event_date ? formatEventDate(project.event_date) : "Sin fecha"}
                </dd>
              </div>
              {eventTime && (
                <div className="flex items-center gap-1.5">
                  <Clock size={15} className="text-brand-muted" aria-hidden />
                  <dt className="sr-only">Hora</dt>
                  <dd className="text-brand-text">{eventTime}</dd>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <MapPin size={15} className="text-brand-muted" aria-hidden />
                <dt className="sr-only">Lugar</dt>
                <dd className={project.location_name ? "text-brand-text" : "text-brand-muted"}>
                  {project.location_name ?? "Sin lugar"}
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <UserRound size={15} className="text-brand-muted" aria-hidden />
                <dt className="sr-only">Responsable</dt>
                <dd className={managerName ? "text-brand-text" : "text-brand-muted"}>
                  {managerName ?? "Sin responsable"}
                </dd>
              </div>
              {quotationNumber && project.quotation_id && (
                <div className="flex items-center gap-1.5">
                  <FileText size={15} className="text-brand-muted" aria-hidden />
                  <dt className="sr-only">Cotización de origen</dt>
                  <dd>
                    <Link href={`/quotations/${project.quotation_id}`} className="text-brand-accent hover:underline">
                      Desde {quotationNumber}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {canUpdate && !isCancelled && project.status !== "COMPLETED" && (
            <ConfirmButton
              label="Cancelar proyecto"
              icon={<XCircle size={14} />}
              confirmTitle="¿Cancelar este proyecto?"
              confirmMessage="El proyecto queda como Cancelado. Puedes reactivarlo después si hace falta; no se borra ningún dato."
              confirmLabel="Sí, cancelar"
              onConfirm={updateProjectStatusAction.bind(null, project.id, "CANCELLED")}
            />
          )}
        </div>

        {/* Avance del proyecto: pasos del flujo, clic para moverlo */}
        {isCancelled ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] bg-brand-danger-bg px-4 py-3 text-sm text-brand-danger">
            <span className="inline-flex items-center gap-2 font-medium">
              <XCircle size={16} /> Este proyecto está cancelado.
            </span>
            {canUpdate && (
              <form action={updateProjectStatusAction.bind(null, project.id, "PLANNING")}>
                <Button type="submit" variant="outline" size="sm" icon={<RotateCcw size={14} />}>
                  Reactivar en Planificación
                </Button>
              </form>
            )}
          </div>
        ) : (
          <div className="border-t border-brand-border pt-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-brand-muted">
              Avance del proyecto
              {canUpdate && (
                <span className="ml-2 font-normal normal-case tracking-normal">
                  · haz clic en un paso para cambiar el estado
                </span>
              )}
            </p>
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROJECT_FLOW.map((step, i) => {
                const done = i < currentStep;
                const current = i === currentStep;
                const circle = (
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      done
                        ? "bg-brand-success text-white"
                        : current
                          ? "bg-brand-accent text-white ring-4 ring-brand-accent-light"
                          : "border border-brand-border bg-brand-surface text-brand-muted"
                    }`}
                  >
                    {done ? <Check size={14} /> : i + 1}
                  </span>
                );
                const content = (
                  <>
                    {circle}
                    <span
                      className={`text-sm ${current ? "font-semibold text-brand-text" : done ? "text-brand-text" : "text-brand-muted"}`}
                    >
                      {PROJECT_STATUS_LABELS[step]}
                    </span>
                  </>
                );
                const base =
                  "flex w-full items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 text-left";
                return (
                  <li key={step}>
                    {canUpdate && !current ? (
                      <form action={updateProjectStatusAction.bind(null, project.id, step)}>
                        <button
                          type="submit"
                          title={`Mover a ${PROJECT_STATUS_LABELS[step]}`}
                          className={`${base} border-brand-border bg-brand-surface transition-colors hover:border-brand-accent/40 hover:bg-brand-accent-light`}
                        >
                          {content}
                        </button>
                      </form>
                    ) : (
                      <div
                        className={`${base} ${current ? "border-brand-accent/40 bg-brand-accent-light" : "border-brand-border bg-brand-surface"}`}
                        aria-current={current ? "step" : undefined}
                      >
                        {content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </Card>

      {/* Números clave, siempre visibles */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Presupuesto"
          value={formatMoney(profitability.presupuesto)}
          pct={profitability.presupuestoConsumidoPct}
          danger={(profitability.presupuestoConsumidoPct ?? 0) > 100}
          hint={
            profitability.presupuesto > 0
              ? `Gastado ${formatMoney(profitability.costoReal)} (${formatPercent(profitability.presupuestoConsumidoPct)})`
              : "Sin presupuesto definido"
          }
        />
        <MetricCard
          label="Facturado"
          value={formatMoney(profitability.facturado)}
          hint={`Cotizado ${formatMoney(profitability.cotizado)}`}
        />
        <MetricCard
          label="Cobrado"
          value={formatMoney(profitability.cobrado)}
          pct={profitability.facturado > 0 ? (profitability.cobrado / profitability.facturado) * 100 : null}
          hint={porCobrar > 0 ? `Por cobrar ${formatMoney(porCobrar)}` : "Nada pendiente por cobrar"}
        />
        <MetricCard
          label="Utilidad real"
          value={formatMoney(profitability.utilidadReal)}
          danger={profitability.utilidadReal < 0}
          hint={`Margen ${formatPercent(profitability.margenReal)} · Facturado − gastos`}
        />
      </section>

      {/* Pestañas */}
      <nav
        aria-label="Secciones del proyecto"
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-brand-border px-4 md:mx-0 md:px-0"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <Link
              key={t.key}
              href={`/projects/${id}?tab=${t.key}`}
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "border-brand-accent font-medium text-brand-accent"
                  : "border-transparent text-brand-muted hover:text-brand-text"
              }`}
            >
              <Icon size={15} aria-hidden />
              {t.label}
            </Link>
          );
        })}
      </nav>

      {activeTab === "resumen" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="flex flex-col gap-4 lg:col-span-2">
            <SectionHeader
              title="Líneas del proyecto"
              description="Servicios y productos del evento, con su costo estimado."
              count={items.length}
            />
            <DataTable
              columns={itemColumns}
              rows={items}
              keyFor={(i) => i.id}
              maxWidth="max-w-none"
              emptyMessage="Sin líneas todavía. Agrega la primera abajo."
            />
            {canUpdate && <NewProjectItemForm projectId={project.id} services={services} />}

            <Card className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-brand-muted">Total de líneas</p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(linesTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-brand-muted">Costo estimado</p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(estimatedCostTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-brand-muted">Margen estimado</p>
                <p
                  className={`text-lg font-semibold tabular-nums ${estimatedMargin !== null && estimatedMargin < 0 ? "text-brand-danger" : ""}`}
                >
                  {formatPercent(estimatedMargin)}
                </p>
              </div>
              {project.budget > 0 && (
                <div className="sm:col-span-3">
                  <div className="mb-1.5 flex justify-between text-xs text-brand-muted">
                    <span>Costo estimado vs. presupuesto</span>
                    <span className="tabular-nums">
                      {((estimatedCostTotal / project.budget) * 100).toFixed(0)}% de{" "}
                      {formatMoney(project.budget)}
                    </span>
                  </div>
                  <ProgressBar
                    pct={(estimatedCostTotal / project.budget) * 100}
                    danger={estimatedCostTotal > project.budget}
                  />
                </div>
              )}
            </Card>
          </section>

          <section>
            <SectionHeader title="Detalles del evento" description="Fecha, lugar, responsable y presupuesto." />
            <Card>
              <ProjectEditForm project={project} members={members} />
            </Card>
          </section>
        </div>
      ) : activeTab === "finanzas" ? (
        <div className="flex flex-col gap-8">
          <section>
            <SectionHeader title="Ingresos" description="Lo que se le cotizó, facturó y cobró al cliente." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Cotizado" value={formatMoney(profitability.cotizado)} />
              <KpiCard label="Facturado" value={formatMoney(profitability.facturado)} />
              <KpiCard label="Cobrado" value={formatMoney(profitability.cobrado)} />
              <KpiCard label="Por cobrar" value={formatMoney(porCobrar)} danger={porCobrar > 0} />
            </div>
          </section>
          <section>
            <SectionHeader title="Costos" description="Lo estimado en las líneas contra lo gastado de verdad." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard label="Costo estimado" value={formatMoney(profitability.costoEstimado)} />
              <KpiCard label="Costo real (gastos)" value={formatMoney(profitability.costoReal)} />
              <MetricCard
                label="Presupuesto consumido"
                value={formatPercent(profitability.presupuestoConsumidoPct)}
                pct={profitability.presupuestoConsumidoPct}
                danger={(profitability.presupuestoConsumidoPct ?? 0) > 100}
                hint={`de ${formatMoney(profitability.presupuesto)}`}
              />
            </div>
          </section>
          <section>
            <SectionHeader title="Rentabilidad" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MetricCard
                label="Utilidad estimada"
                value={formatMoney(profitability.utilidadEstimada)}
                danger={profitability.utilidadEstimada < 0}
                hint={`Margen ${formatPercent(profitability.margenEstimado)} · Cotizado − costo estimado`}
              />
              <MetricCard
                label="Utilidad real"
                value={formatMoney(profitability.utilidadReal)}
                danger={profitability.utilidadReal < 0}
                hint={`Margen ${formatPercent(profitability.margenReal)} · Facturado − costo real`}
              />
            </div>
          </section>
          <p className="text-xs text-brand-muted">
            Todos los montos se consolidan en la moneda base de la empresa, usando la tasa de
            cambio ya congelada de cada factura, gasto o cobro (nunca la tasa actual).
          </p>
        </div>
      ) : activeTab === "ventas" && quotations && invoices && customerPayments ? (
        <div className="flex flex-col gap-8">
          <section>
            <SectionHeader title="Cotizaciones" count={quotations.length} />
            <DataTable columns={quotationColumns} rows={quotations} keyFor={(q) => q.id} emptyMessage="Sin cotizaciones ligadas." maxWidth="max-w-none" />
          </section>
          <section>
            <SectionHeader
              title="Facturas"
              count={invoices.length}
              action={
                <Link href="/invoices/new">
                  <Button variant="outline" size="sm" icon={<Plus size={14} />}>
                    Nueva factura
                  </Button>
                </Link>
              }
            />
            <DataTable columns={invoiceColumns} rows={invoices} keyFor={(i) => i.id} emptyMessage="Sin facturas todavía." maxWidth="max-w-none" />
          </section>
          <section>
            <SectionHeader title="Cobros recibidos" count={customerPayments.length} />
            <DataTable columns={paymentColumns} rows={customerPayments} keyFor={(p) => p.id} emptyMessage="Sin cobros todavía." maxWidth="max-w-none" />
          </section>
        </div>
      ) : activeTab === "compras" && expenses && projectSuppliers && supplierPayments ? (
        <div className="flex flex-col gap-8">
          <section>
            <SectionHeader
              title="Gastos"
              count={expenses.length}
              action={
                <Link href="/expenses/new">
                  <Button variant="outline" size="sm" icon={<Plus size={14} />}>
                    Nuevo gasto
                  </Button>
                </Link>
              }
            />
            <DataTable columns={expenseColumns} rows={expenses} keyFor={(e) => e.id} emptyMessage="Sin gastos todavía." maxWidth="max-w-none" />
          </section>
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-5">
            <section className="xl:col-span-2">
              <SectionHeader title="Proveedores" count={projectSuppliers.length} />
              <DataTable
                columns={supplierColumns}
                rows={projectSuppliers}
                keyFor={(s) => s.supplierId}
                emptyMessage="Sin proveedores asociados a gastos de este proyecto."
                maxWidth="max-w-none"
              />
            </section>
            <section className="xl:col-span-3">
              <SectionHeader title="Pagos a proveedores" count={supplierPayments.length} />
              <DataTable
                columns={supplierPaymentColumns}
                rows={supplierPayments}
                keyFor={(p) => p.id}
                emptyMessage="Sin pagos todavía."
                maxWidth="max-w-none"
              />
            </section>
          </div>
        </div>
      ) : activeTab === "bancos" && bankTransactions ? (
        <section>
          <SectionHeader title="Movimientos bancarios" count={bankTransactions.length} />
          <DataTable columns={bankColumns} rows={bankTransactions} keyFor={(t) => t.id} emptyMessage="Sin movimientos todavía." maxWidth="max-w-none" />
        </section>
      ) : activeTab === "documentos" && documents ? (
        <section className="flex max-w-3xl flex-col gap-4">
          <SectionHeader title="Documentos" count={documents.length} description="Contratos, facturas de proveedores, planos, fotos…" />
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
        </section>
      ) : activeTab === "tareas" && projectTasks ? (
        <section className="flex flex-col gap-4">
          <SectionHeader title="Tareas" count={projectTasks.length} />
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
        </section>
      ) : activeTab === "actividades" && projectActivities ? (
        <section className="flex max-w-3xl flex-col gap-4">
          <SectionHeader
            title="Actividades"
            count={projectActivities.length}
            description="Llamadas, reuniones, visitas y notas del evento."
          />
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
        </section>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-brand-border p-8 text-center">
          <p className="text-sm text-brand-muted">Pestaña no encontrada.</p>
        </div>
      )}
    </main>
  );
}
