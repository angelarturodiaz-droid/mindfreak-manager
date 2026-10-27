import Link from "next/link";
import { billingProgress } from "@/features/projects/billing-progress";
import { BillingNotice } from "@/components/projects/billing-notice";
import { withReturnTo } from "@/lib/utils/return-to";
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
  Gift,
  Truck,
  Wallet,
  Paperclip,
  Landmark,
  Info,
  LayoutDashboard,
  ListChecks,
  Lock,
  MapPin,
  MessageSquare,
  Plus,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Smile,
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
  listProjectIncentives,
  getProjectBilling,
  listProjectQuotations,
  getOpenProjectQuotation,
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
import { transactionEffect } from "@/features/banks/queries";
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
import { CompleteProjectStep } from "@/components/surveys/complete-project-step";
import { ProjectSurveyPanel } from "@/components/surveys/project-survey-panel";
import { getSurveySettings, listProjectSurveys, resolveSurveyRecipient } from "@/features/surveys/queries";
import { relationName, relationRow } from "@/lib/utils/relation";
import { ProjectEditForm } from "./project-edit-form";
import { NewProjectItemForm } from "./new-item-form";
import { EditCostButton } from "./edit-cost-button";
import { CreateQuotationButton } from "./create-quotation-button";
import { RecalcIncentiveButton } from "./recalc-incentive-button";
import { FoldableSection } from "@/components/ui/foldable-section";
import { RECIPIENT_TYPE_LABELS } from "@/features/incentives/catalog";
import { incentiveAmountFromPercent } from "@/features/profitability/net-of-tax";
import { formatDate } from "@/lib/utils/dates";
import { Tooltip } from "@/components/ui/tooltip";
import { InfoHint } from "@/components/ui/info-hint";
import { Callout, Chip } from "@/components/ui/page-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, KpiCard } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ActionBlock } from "@/components/ui/action-block";
import { ActionButton } from "@/components/ui/action-button";
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
  {
    key: "resumen",
    label: "Resumen",
    icon: LayoutDashboard,
    hint: "Lo esencial del evento: los servicios en una línea y los detalles (nombre, responsable, fecha, lugar y presupuesto), que se editan aquí.",
  },
  {
    key: "servicios",
    label: "Servicios",
    icon: ListChecks,
    hint: "Lo que se le vende al cliente en este evento: cada línea con la cotización de donde viene, su precio y su costo estimado. Si vienen de una cotización aprobada quedan fijas; lo que el cliente pida de más va por una cotización adicional.",
  },
  {
    key: "finanzas",
    label: "Finanzas",
    icon: TrendingUp,
    hint: "Los números del proyecto: lo cotizado, facturado y cobrado, los gastos, y la utilidad estimada y real con su margen.",
  },
  {
    key: "ventas",
    label: "Ventas y cobros",
    icon: Receipt,
    hint: "Cotizaciones, facturas y cobros del cliente para este proyecto, con el aviso Cotizado vs. facturado (cuánto falta por facturar).",
  },
  {
    key: "compras",
    label: "Gastos y proveedores",
    icon: ShoppingCart,
    hint: "Gastos del evento, proveedores que trabajan en él y lo que ya se les pagó. Lo que gastas aquí baja la utilidad real.",
  },
  {
    key: "bancos",
    label: "Bancos",
    icon: Landmark,
    hint: "Movimientos de banco ligados a este proyecto: lo que entró y lo que salió de las cuentas.",
  },
  {
    key: "tareas",
    label: "Tareas",
    icon: CheckSquare,
    hint: "Pendientes del equipo para este evento, con responsable, fecha y prioridad.",
  },
  {
    key: "documentos",
    label: "Documentos",
    icon: FolderOpen,
    hint: "Archivos del proyecto: contratos, planos, fotos, acuses de recibo y otros.",
  },
  {
    key: "actividades",
    label: "Actividades",
    icon: MessageSquare,
    hint: "Bitácora del proyecto: notas de llamadas, reuniones y cambios, con fecha y quién las escribió.",
  },
  {
    key: "satisfaccion",
    label: "Satisfacción del cliente",
    icon: Smile,
    hint: "Encuesta de satisfacción del cliente: envío, recordatorios y respuestas (calificación, NPS y comentarios).",
  },
] as const;

/** Qué significa cada paso del proyecto (línea corta y explicación al pasar el mouse). */
const STEP_HELP: Record<string, { sub: string; help: string }> = {
  PLANNING: {
    sub: "Se está armando",
    help: "El evento se está preparando: fecha, lugar, servicios y equipo. El cliente todavía no lo confirma. Haz clic en otro paso para cambiar el estado.",
  },
  CONFIRMED: {
    sub: "El cliente confirmó",
    help: "El cliente confirmó el evento (normalmente con el anticipo). Se reservan proveedores y se reparten las tareas.",
  },
  IN_PROGRESS: {
    sub: "Se está ejecutando",
    help: "El evento está en marcha: montaje y día del evento. Se registran gastos, entregas y acuses.",
  },
  COMPLETED: {
    sub: "Terminado",
    help: "El evento terminó. Al pasarlo aquí se ofrece enviar la encuesta de satisfacción. Las facturas pendientes se siguen cobrando.",
  },
};

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
  info,
}: {
  label: string;
  value: string;
  info?: string;
  hint?: React.ReactNode;
  pct?: number | null;
  danger?: boolean;
}) {
  return (
    <Card className="@container flex min-w-0 flex-col gap-2">
      <p className="flex items-center gap-1 text-sm font-medium text-brand-muted">
        {label}
        {info && <InfoHint text={info} />}
      </p>
      <p
        className={`whitespace-nowrap text-base @[12rem]:text-lg @[15rem]:text-xl font-semibold tracking-tight tabular-nums ${danger ? "text-brand-danger" : "text-brand-text"}`}
      >
        {value}
      </p>
      {pct !== undefined && pct !== null && <ProgressBar pct={pct} danger={danger || pct > 100} />}
      {hint && <p className="text-xs text-brand-muted">{hint}</p>}
    </Card>
  );
}

/** Un renglón de la rentabilidad en cascada (Finanzas). */
function CascadeRow({
  label,
  value,
  info,
  strong,
  danger,
}: {
  label: string;
  value: string;
  info: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={`flex items-center gap-1 ${strong ? "font-semibold text-brand-text" : "text-brand-muted"}`}>
        {label}
        <InfoHint text={info} />
      </dt>
      <dd className={`whitespace-nowrap ${strong ? "font-semibold" : ""} ${danger ? "text-brand-danger" : "text-brand-text"}`}>{value}</dd>
    </div>
  );
}

const UTILIDAD_REAL_INFO =
  "Lo que de verdad se ganó: facturado sin ITBIS − gastos sin ITBIS − incentivos. El ITBIS que le cobras al cliente se le paga a la DGII y el de tus compras no es costo, por eso no cuentan. El margen es la utilidad ÷ lo facturado sin ITBIS.";
const PRESUPUESTO_INFO =
  "El presupuesto es lo que planeaste gastar en este evento (lo escribes al crear o editar el proyecto). La barra muestra cuánto ya gastaste de ese monto, con los gastos sin ITBIS. Si pasa de 100 % se pone en rojo: gastaste más de lo planeado.";

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

  const [items, members, services, canUpdate, profitability, billingData, canIncentives] = await Promise.all([
    listProjectItems(id),
    listCompanyMembers(),
    listActiveServices(),
    hasPermission("projects.update"),
    getProjectProfitability(id),
    getProjectBilling(id),
    hasPermission("expenses.incentives"),
  ]);
  // Cotizado (aprobado) vs. facturado: un proyecto puede tener varias facturas.
  const billing = billingProgress(billingData);

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
    incentives,
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
    activeTab === "finanzas" ? listProjectIncentives(id) : null,
  ]);

  const clientName = relationName(project.clients);
  const quotationNumber = relationRow<{ number: string }>(project.quotations)?.number;
  const manager = members.find((m) => m.id === project.manager_id);
  const managerName = manager ? manager.full_name || manager.email : null;
  const countdown = eventCountdown(project.event_date, project.status);
  const eventTime = formatEventTime(project.event_time);
  const isCancelled = project.status === "CANCELLED";
  const currentStep = PROJECT_FLOW.indexOf(project.status as (typeof PROJECT_FLOW)[number]);

  // Cierre del proyecto: datos para "¿Deseas enviar la encuesta de satisfacción?"
  const showCloseDialog = canUpdate && !isCancelled && project.status !== "COMPLETED";
  const canSendSurvey = await hasPermission("surveys.send");
  const [surveySettings, surveyRecipient, projectSurveys] = showCloseDialog
    ? await Promise.all([getSurveySettings(), resolveSurveyRecipient(id), listProjectSurveys(id)])
    : [null, null, []];
  const activeSurvey = projectSurveys.find((s) => s.status === "SENT" || s.status === "ANSWERED");

  // Servicios: fijos si el proyecto viene de una cotización aprobada (migración 086).
  const itemsLocked = Boolean(project.quotation_id);
  const [canCreateQuotation, openQuotation, allProjectQuotations] = await Promise.all([
    hasPermission("quotations.create"),
    activeTab === "servicios" && !itemsLocked ? getOpenProjectQuotation(id) : Promise.resolve(null),
    activeTab === "servicios" && itemsLocked ? listProjectQuotations(id) : Promise.resolve(null),
  ]);
  const pendingAdditional = (allProjectQuotations ?? []).filter(
    (q) => q.id !== project.quotation_id && ["DRAFT", "SENT", "VIEWED", "NEGOTIATING"].includes(q.status),
  );

  // Total de líneas = con impuesto (lo que paga el cliente).
  const linesTotal = items.reduce((sum, i) => sum + i.subtotal, 0);
  // Venta sin impuesto (cantidad × precio unitario): el ITBIS no es ganancia,
  // así que el margen estimado se calcula sobre esta base.
  const linesBase = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);
  const estimatedCostTotal = items.reduce((sum, i) => sum + i.estimated_cost, 0);
  const estimatedMargin = linesBase > 0 ? ((linesBase - estimatedCostTotal) / linesBase) * 100 : null;
  // Por cobrar es dinero: se compara con lo facturado CON ITBIS.
  const porCobrar = Math.max(0, profitability.facturadoConItbis - profitability.cobrado);

  const itemColumns: Column<ProjectItemRow>[] = [
    { header: "Descripción", accessor: (i) => <span className="text-brand-text">{i.description}</span> },
    {
      header: "Origen",
      info: "De qué cotización viene la línea. «Escrita a mano» = agregada en el proyecto (solo en proyectos sin cotización aprobada).",
      accessor: (i) => (i.source ? <Chip tone="accent">De {i.source.number}</Chip> : <Chip tone="muted">Escrita a mano</Chip>),
    },
    { header: "Cant.", className: "text-right", accessor: (i) => <span className="tabular-nums">{i.quantity}</span> },
    {
      header: "Precio unit.",
      info: "Lo que se le cobra al cliente por cada unidad, sin impuesto.",
      className: "text-right",
      accessor: (i) => <span className="tabular-nums">{formatMoney(i.unit_price)}</span>,
    },
    {
      header: "Costo unit. est.",
      info: "Lo que crees que te cuesta cada unidad (interno, el cliente no lo ve). Con el lápiz se corrige; queda en la Auditoría. Escríbelo sin ITBIS si el proveedor te da un comprobante válido para crédito fiscal; si no lo puedes recuperar (proveedor informal o venta exenta), inclúyelo.",
      className: "text-right",
      accessor: (i) => (
        <span className="inline-flex items-center justify-end gap-1">
          <span className="tabular-nums text-brand-muted">
            {formatMoney(Number(i.quantity) > 0 ? Number(i.estimated_cost) / Number(i.quantity) : 0)}
          </span>
          {canUpdate && !isCancelled && (
            <EditCostButton
              itemId={i.id}
              projectId={project.id}
              description={i.description}
              quantity={Number(i.quantity)}
              unitCost={Number(i.quantity) > 0 ? Math.round((Number(i.estimated_cost) / Number(i.quantity)) * 100) / 100 : 0}
            />
          )}
        </span>
      ),
    },
    {
      header: "Costo total est.",
      info: "Cantidad × costo unitario estimado: lo que crees que te costará toda la línea.",
      className: "hidden text-right sm:table-cell",
      accessor: (i) => <span className="tabular-nums text-brand-muted">{formatMoney(i.estimated_cost)}</span>,
    },
    {
      header: "Total línea",
      info: "Lo que paga el cliente por esta línea: cantidad × precio unitario, más el impuesto (ITBIS) si aplica.",
      className: "text-right",
      accessor: (i) => <span className="font-medium tabular-nums">{formatMoney(i.subtotal)}</span>,
    },
    {
      header: "",
      className: "text-right",
      accessor: (i) =>
        canUpdate && !itemsLocked && !isCancelled ? (
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
        <Link href={withReturnTo(`/quotations/${q.id}`, `/projects/${project.id}?tab=ventas`)} className="font-medium text-brand-accent hover:underline">
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
        <Link href={withReturnTo(`/invoices/${inv.id}`, `/projects/${project.id}?tab=ventas`)} className="font-medium text-brand-accent hover:underline">
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
        // Una factura cancelada ya no se cobra: su balance sale en gris (no es deuda).
        <span
          className={`tabular-nums ${inv.status === "CANCELLED" ? "text-brand-muted line-through" : inv.balance > 0 ? "text-brand-warning" : "text-brand-muted"}`}
          title={inv.status === "CANCELLED" ? "Factura cancelada: no se cobra" : undefined}
        >
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
        <Link href={withReturnTo(`/invoices/${p.invoice_id}`, `/projects/${project.id}?tab=ventas`)} className="text-brand-accent hover:underline">
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
        <Link href={withReturnTo(`/expenses/${e.id}`, `/projects/${project.id}?tab=compras`)} className="text-brand-accent hover:underline">
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
        <Link href={withReturnTo(`/suppliers/${s.supplierId}`, `/projects/${project.id}?tab=compras`)} className="text-brand-accent hover:underline">
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
        <Link href={withReturnTo(`/expenses/${p.expense_id}`, `/projects/${project.id}?tab=compras`)} className="text-brand-accent hover:underline">
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
      header: "Categoría",
      accessor: (t) => {
        const name = relationName(t.expense_categories);
        return name ? (
          <span className="text-brand-text">{name}</span>
        ) : (
          <span className="text-xs font-medium text-brand-warning">Sin categoría</span>
        );
      },
    },
    {
      header: "Monto",
      className: "text-right",
      accessor: (t) => {
        // Mismo criterio que el balance de la cuenta: los gastos se guardan en
        // positivo pero salen de la cuenta.
        const effect = transactionEffect(t.type, t.amount);
        return (
          <span className={`whitespace-nowrap font-medium tabular-nums ${effect < 0 ? "text-brand-danger" : "text-brand-success"}`}>
            {effect < 0 ? "−" : "+"}
            {formatMoney(Math.abs(effect), t.currency)}
          </span>
        );
      },
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
              <span
                className="rounded-[var(--radius-md)] bg-brand-accent-light px-2.5 py-1 text-base font-semibold tabular-nums text-brand-accent"
                title="Número del proyecto"
              >
                {project.number}
              </span>
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
                  <Link href={withReturnTo(`/clients/${project.client_id}`, `/projects/${project.id}`)} className="text-brand-text hover:text-brand-accent">
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
                    <Link href={withReturnTo(`/quotations/${project.quotation_id}`, `/projects/${project.id}`)} className="text-brand-accent hover:underline">
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
              <ActionButton
                label="Reactivar en Planificación"
                icon={<RotateCcw size={14} />}
                onAction={updateProjectStatusAction.bind(null, project.id, "PLANNING")}
              />
            )}
          </div>
        ) : (
          <div className="border-t border-brand-border pt-5">
            <p className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium uppercase tracking-wide text-brand-muted">
              Avance del proyecto
              <span className="hidden font-normal normal-case tracking-normal sm:inline">
                {canUpdate ? "· haz clic en un paso para cambiar el estado · " : "· "}pasa el mouse por la ⓘ para ver qué significa
              </span>
              <InfoHint text="Un proyecto pasa por estos pasos: Planificación → Confirmado → En curso → Completado. El paso en azul es donde está ahora; los verdes ya se cumplieron. Si tienes permiso, haz clic en un paso para mover el proyecto ahí." />
            </p>
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROJECT_FLOW.map((step, i) => {
                // Pasos completados en verde; el último (Completado) cuenta como completado al llegar.
                const done = i < currentStep || (i === currentStep && i === PROJECT_FLOW.length - 1);
                const current = i === currentStep && !done;
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
                    <span className="flex min-w-0 flex-col">
                      <span
                        className={`text-sm ${current ? "font-semibold text-brand-text" : done ? "text-brand-text" : "text-brand-muted"}`}
                      >
                        {PROJECT_STATUS_LABELS[step]}
                      </span>
                      <span className="text-xs leading-snug text-brand-muted">{STEP_HELP[step]?.sub}</span>
                    </span>
                    <Info size={14} aria-hidden className="ml-auto shrink-0 self-start text-brand-muted" />
                  </>
                );
                const base =
                  "flex w-full items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 text-left";
                return (
                  <Tooltip key={step} text={STEP_HELP[step]?.help ?? ""}>
                  <li>
                    {canUpdate && !current && i !== currentStep && step === "COMPLETED" ? (
                      <CompleteProjectStep
                        projectId={project.id}
                        title={`Mover a ${PROJECT_STATUS_LABELS[step]}`}
                        className={`${base} ${done ? "border-brand-success/40 bg-brand-success-bg" : "border-brand-border bg-brand-surface"} transition-colors hover:border-brand-accent/40 hover:bg-brand-accent-light`}
                        canSend={canSendSurvey}
                        sendByDefault={surveySettings?.send_by_default ?? true}
                        recipientName={surveyRecipient?.name ?? null}
                        recipientEmail={surveyRecipient?.email ?? null}
                        recipientPhone={surveyRecipient?.phone ?? null}
                        existing={
                          activeSurvey
                            ? { status: activeSurvey.status, date: activeSurvey.responded_at ?? activeSurvey.sent_at }
                            : null
                        }
                      >
                        {content}
                      </CompleteProjectStep>
                    ) : canUpdate && !current && i !== currentStep ? (
                      <ActionBlock
                        onAction={updateProjectStatusAction.bind(null, project.id, step)}
                        title={`Mover a ${PROJECT_STATUS_LABELS[step]}`}
                        className={`${base} ${done ? "border-brand-success/40 bg-brand-success-bg" : "border-brand-border bg-brand-surface"} transition-colors hover:border-brand-accent/40 hover:bg-brand-accent-light`}
                      >
                        {content}
                      </ActionBlock>
                    ) : (
                      <div
                        className={`${base} ${done ? "border-brand-success/40 bg-brand-success-bg" : current ? "border-brand-accent/40 bg-brand-accent-light" : "border-brand-border bg-brand-surface"}`}
                        aria-current={i === currentStep ? "step" : undefined}
                      >
                        {content}
                      </div>
                    )}
                  </li>
                  </Tooltip>
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
          info={PRESUPUESTO_INFO}
          hint={
            profitability.presupuesto > 0
              ? `Gastado sin ITBIS ${formatMoney(profitability.costoReal)} (${formatPercent(profitability.presupuestoConsumidoPct)})`
              : "Sin presupuesto definido"
          }
        />
        <MetricCard
          label="Facturado"
          info="Lo que ya le facturaste al cliente en este proyecto (facturas emitidas, con ITBIS, como dicen las facturas). La barra compara con lo que el cliente aprobó en las cotizaciones."
          value={formatMoney(profitability.facturadoConItbis)}
          pct={billing.pct}
          danger={billing.state === "over"}
          hint={
            billing.state === "none"
              ? "Sin cotización aprobada para comparar"
              : billing.state === "over"
                ? `${formatMoney(-billing.restante)} más de lo cotizado (${formatMoney(billing.cotizado)})`
                : billing.state === "complete"
                  ? `Todo lo cotizado (${formatMoney(billing.cotizado)}) facturado`
                  : `Falta por facturar ${formatMoney(billing.restante)} de ${formatMoney(billing.cotizado)}`
          }
        />
        <MetricCard
          label="Cobrado"
          info="Dinero que el cliente ya pagó por este proyecto. La barra es la parte de lo facturado que ya entró al banco."
          value={formatMoney(profitability.cobrado)}
          pct={profitability.facturadoConItbis > 0 ? (profitability.cobrado / profitability.facturadoConItbis) * 100 : null}
          hint={porCobrar > 0 ? `Por cobrar ${formatMoney(porCobrar)}` : "Nada pendiente por cobrar"}
        />
        <MetricCard
          label="Utilidad real"
          value={formatMoney(profitability.utilidadReal)}
          danger={profitability.utilidadReal < 0}
          info={UTILIDAD_REAL_INFO}
          hint={`Margen ${formatPercent(profitability.margenReal)} · Facturado − gastos − incentivos, sin ITBIS`}
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
            <Tooltip key={t.key} text={t.hint}>
              <Link
                href={`/projects/${id}?tab=${t.key}`}
                className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "border-brand-accent font-medium text-brand-accent"
                    : "border-transparent text-brand-muted hover:text-brand-text"
                }`}
              >
                <Icon size={15} aria-hidden />
                {t.label}
                <Info size={12} aria-hidden className="opacity-60" />
              </Link>
            </Tooltip>
          );
        })}
      </nav>

      {activeTab === "resumen" ? (
        <div className="flex flex-col gap-6">
          {/* Servicios en una línea; el detalle está en la pestaña Servicios. */}
          <Card className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
              <ListChecks size={16} className="text-brand-accent" aria-hidden />
              Servicios
              <InfoHint text="Lo que se le vende al cliente en este evento. El detalle (cada línea, su origen y su costo estimado) está en la pestaña Servicios." />
            </span>
            <span className="text-sm text-brand-text">
              {items.length} {items.length === 1 ? "línea" : "líneas"} · <strong className="tabular-nums">{formatMoney(linesTotal)}</strong>
            </span>
            <span className="text-sm text-brand-muted">
              Costo estimado <span className="tabular-nums">{formatMoney(estimatedCostTotal)}</span> · margen{" "}
              <span className={estimatedMargin !== null && estimatedMargin < 0 ? "text-brand-danger" : ""}>{formatPercent(estimatedMargin)}</span>
            </span>
            <Link href={`/projects/${id}?tab=servicios`} className="ml-auto text-sm font-medium text-brand-accent hover:underline">
              Ver servicios →
            </Link>
          </Card>

          <section className="max-w-3xl">
            <SectionHeader title="Detalles del evento" description="Nombre, responsable, fecha, lugar y presupuesto." />
            <Card>
              <ProjectEditForm project={project} members={members} />
            </Card>
          </section>
        </div>
      ) : activeTab === "servicios" ? (
        <section className="flex flex-col gap-4">
          <SectionHeader
            title="Servicios del proyecto"
            description="Lo que se le vende al cliente en este evento, con su costo estimado."
            count={items.length}
          />

          {itemsLocked ? (
            <Callout
              icon={<Lock size={18} />}
              title={
                items.length === 0
                  ? `La cotización ${quotationNumber ?? ""} se aprobó sin líneas`
                  : `Estas líneas vienen de ${quotationNumber ?? "la cotización"} (aprobada) y quedan fijas`
              }
              description={
                items.length === 0
                  ? "Este proyecto no tiene servicios todavía. Si el cliente pidió algo, hazlo en una cotización adicional: cuando la apruebe, sus líneas aparecen aquí solas (y en cada línea podrás corregir el costo estimado con el lápiz)."
                  : "Es lo que el cliente aprobó. Si pide algo de más, haz una cotización adicional: cuando la apruebe, sus líneas se suman aquí solas. El costo estimado (interno) sí se puede corregir con el lápiz."
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                {canCreateQuotation && !isCancelled && (
                  <Link
                    href={`/quotations/new?project=${project.id}&return_to=${encodeURIComponent(`/projects/${project.id}?tab=servicios`)}`}
                  >
                    <Button size="sm" icon={<Plus size={14} />}>
                      Nueva cotización adicional
                    </Button>
                  </Link>
                )}
                {pendingAdditional.map((q) => (
                  <Link
                    key={q.id}
                    href={withReturnTo(`/quotations/${q.id}`, `/projects/${project.id}?tab=servicios`)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-surface px-2.5 py-1 text-xs text-brand-text hover:border-brand-accent"
                  >
                    {q.number} · {QUOTATION_STATUS_LABELS[q.status] ?? q.status} · {formatMoney(q.total, q.currency)}
                  </Link>
                ))}
              </div>
            </Callout>
          ) : (
            <Callout
              icon={<ListChecks size={18} />}
              title="Proyecto sin cotización aprobada: las líneas se escriben aquí"
              description={
                openQuotation
                  ? `La cotización ${openQuotation.number} (${QUOTATION_STATUS_LABELS[openQuotation.status] ?? openQuotation.status}) se armó con estas líneas: cuando el cliente la apruebe, sus líneas reemplazan estas y quedan fijas.`
                  : "Puedes agregar o quitar líneas mientras el proyecto no esté Completado. Para que el cliente apruebe los precios por escrito, crea una cotización con estas líneas."
              }
              tone="amber"
            >
              <div className="flex flex-wrap items-center gap-2">
                {openQuotation ? (
                  <Link href={withReturnTo(`/quotations/${openQuotation.id}`, `/projects/${project.id}?tab=servicios`)}>
                    <Button size="sm" variant="outline" icon={<FileText size={14} />}>
                      Abrir {openQuotation.number}
                    </Button>
                  </Link>
                ) : (
                  canCreateQuotation && items.length > 0 && !isCancelled && <CreateQuotationButton projectId={project.id} />
                )}
              </div>
            </Callout>
          )}

          <DataTable
            columns={itemColumns}
            rows={items}
            keyFor={(i) => i.id}
            maxWidth="max-w-none"
            emptyMessage={itemsLocked ? "Sin líneas." : "Sin líneas todavía. Agrega la primera abajo."}
          />
          {canUpdate && !itemsLocked && !isCancelled && project.status !== "COMPLETED" && (
            <NewProjectItemForm projectId={project.id} services={services} />
          )}

          <Card className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="flex items-center gap-1 text-xs text-brand-muted">
                Total de líneas
                <InfoHint text="Lo que paga el cliente por todas las líneas, con impuesto." />
              </p>
              <p className="text-lg font-semibold tabular-nums">{formatMoney(linesTotal)}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs text-brand-muted">
                Costo estimado
                <InfoHint text="Lo que crees que te costará hacer el evento (suma del costo estimado de cada línea). Es interno: el cliente no lo ve." />
              </p>
              <p className="text-lg font-semibold tabular-nums">{formatMoney(estimatedCostTotal)}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs text-brand-muted">
                Margen estimado
                <InfoHint text={`(Venta sin impuesto − costo estimado) ÷ venta sin impuesto. Venta sin impuesto: ${formatMoney(linesBase)} (el ITBIS no es ganancia, se le paga a la DGII). La utilidad real (con los gastos de verdad) está en Finanzas.`} />
              </p>
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
                    {((estimatedCostTotal / project.budget) * 100).toFixed(0)}% de {formatMoney(project.budget)}
                  </span>
                </div>
                <ProgressBar pct={(estimatedCostTotal / project.budget) * 100} danger={estimatedCostTotal > project.budget} />
              </div>
            )}
          </Card>
        </section>
      ) : activeTab === "finanzas" ? (
        <div className="flex flex-col gap-4">
          <FoldableSection
            storageKey="proyecto.finanzas.ingresos"
            title="Ingresos"
            icon={<Receipt size={16} />}
            description="Lo que se le cotizó (aprobado), facturó (facturas emitidas) y cobró (dinero recibido) al cliente."
            info="Lo que entra por este proyecto: lo aprobado en cotizaciones, lo facturado y lo que el cliente ya pagó."
            summary={<span className="text-xs text-brand-muted">Facturado {formatMoney(profitability.facturadoConItbis)}</span>}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Cotizado"
                value={formatMoney(profitability.cotizadoConItbis)}
                hint={`Sin ITBIS: ${formatMoney(profitability.cotizado)}`}
                info="Total de las cotizaciones aprobadas, tal como las vio el cliente (con ITBIS). Debajo, la venta sin ITBIS, que es la que cuenta para la utilidad."
              />
              <KpiCard
                label="Facturado"
                value={formatMoney(profitability.facturadoConItbis)}
                hint={`Sin ITBIS: ${formatMoney(profitability.facturado)}`}
                info="Total de las facturas emitidas (con ITBIS). Debajo, la venta sin ITBIS: el ITBIS que le cobras al cliente no es tuyo, se le paga a la DGII."
              />
              <KpiCard
                label="Cobrado"
                value={formatMoney(profitability.cobrado)}
                info="Dinero que ya entró por este proyecto. Es dinero real, con ITBIS."
              />
              <KpiCard
                label="Por cobrar"
                value={formatMoney(porCobrar)}
                danger={porCobrar > 0}
                info="Lo que el cliente todavía debe de las facturas de este proyecto (facturado − cobrado)."
              />
            </div>
          </FoldableSection>
          <FoldableSection
            storageKey="proyecto.finanzas.costos"
            title="Costos"
            icon={<ShoppingCart size={16} />}
            description="Lo que calculaste que costaría contra lo que de verdad gastaste (gastos registrados en el proyecto)."
            info="Lo que sale por este proyecto: el costo estimado de los servicios y los gastos de verdad, sin ITBIS."
            summary={<span className="text-xs text-brand-muted">Gastado {formatMoney(profitability.costoReal)}</span>}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard
                label="Costo estimado"
                value={formatMoney(profitability.costoEstimado)}
                info="Lo que calculaste que te costaría el evento: la suma de los costos estimados de cada servicio (pestaña Servicios). Sirve para comparar con lo gastado de verdad."
              />
              <KpiCard
                label="Costo real (gastos, sin ITBIS)"
                value={formatMoney(profitability.costoReal)}
                hint={`Pagado con ITBIS: ${formatMoney(profitability.costoRealConItbis)}`}
                info="Lo que costaron los gastos del proyecto sin su ITBIS. Los gastos se siguen registrando y pagando con ITBIS (el monto de abajo); para la utilidad se toma el subtotal."
              />
              <MetricCard
                label="Presupuesto consumido"
                info={PRESUPUESTO_INFO}
                value={formatPercent(profitability.presupuestoConsumidoPct)}
                pct={profitability.presupuestoConsumidoPct}
                danger={(profitability.presupuestoConsumidoPct ?? 0) > 100}
                hint={`de ${formatMoney(profitability.presupuesto)}`}
              />
            </div>
          </FoldableSection>
          <FoldableSection
            storageKey="proyecto.finanzas.rentabilidad"
            title="Rentabilidad"
            icon={<TrendingUp size={16} />}
            tone="accent"
            description="La ganancia del proyecto: lo vendido menos lo gastado y los incentivos, sin ITBIS."
            info="Cuánto le queda a la empresa con este proyecto, estimado (según lo cotizado) y real (según lo facturado y gastado)."
            summary={
              <span className={`text-xs font-medium ${profitability.utilidadReal < 0 ? "text-brand-danger" : "text-brand-success"}`}>
                Ganancia final {formatMoney(profitability.utilidadReal)}
              </span>
            }
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <MetricCard
                label="Utilidad estimada"
                value={formatMoney(profitability.utilidadEstimada)}
                danger={profitability.utilidadEstimada < 0}
                info="Lo que se espera ganar: cotizado sin ITBIS − costo estimado de las líneas. El margen es esa utilidad ÷ el cotizado sin ITBIS."
                hint={`Margen ${formatPercent(profitability.margenEstimado)} · Cotizado sin ITBIS − costo estimado`}
              />
              <Card className="flex flex-col gap-2">
                <p className="flex items-center gap-1 text-sm font-medium text-brand-muted">
                  Utilidad real, paso a paso
                  <InfoHint text={UTILIDAD_REAL_INFO} />
                </p>
                <dl className="flex flex-col gap-1.5 text-sm tabular-nums">
                  <CascadeRow
                    label="Ventas sin ITBIS"
                    info="Lo facturado al cliente (facturas emitidas), sin el ITBIS."
                    value={formatMoney(profitability.facturado)}
                  />
                  <CascadeRow
                    label="− Gastos sin ITBIS"
                    info="Lo gastado en el proyecto (gastos registrados, sin incentivos), por su subtotal."
                    value={formatMoney(profitability.costoReal > 0 ? -profitability.costoReal : 0)}
                  />
                  <CascadeRow
                    label="= Ganancia antes de incentivos"
                    info="Lo que quedó después de los gastos. Es la base para calcular los incentivos por %."
                    value={formatMoney(profitability.gananciaAntesIncentivos)}
                    strong
                    danger={profitability.gananciaAntesIncentivos < 0}
                  />
                  <CascadeRow
                    label="− Incentivos"
                    info="Pagos a empleados o terceros por este proyecto (lista de abajo). Sin ITBIS ni retenciones."
                    value={formatMoney(profitability.incentivos > 0 ? -profitability.incentivos : 0)}
                  />
                  <div className="mt-1 border-t border-brand-border pt-2">
                    <CascadeRow
                      label="= Ganancia final"
                      info="Lo que de verdad le queda a la empresa con este proyecto. Es la «Utilidad real» de arriba."
                      value={formatMoney(profitability.utilidadReal)}
                      strong
                      danger={profitability.utilidadReal < 0}
                    />
                    <p className="mt-0.5 text-right text-xs text-brand-muted">
                      Margen {formatPercent(profitability.margenReal)} de las ventas sin ITBIS
                    </p>
                  </div>
                </dl>
              </Card>
            </div>
          </FoldableSection>
          <FoldableSection
            storageKey="proyecto.finanzas.incentivos"
            title="Incentivos"
            icon={<Gift size={16} />}
            count={incentives?.length ?? 0}
            info="Pagos a empleados o terceros por este proyecto. Se restan después de los gastos."
            summary={profitability.incentivos > 0 ? <span className="text-xs text-brand-muted">{formatMoney(profitability.incentivos)}</span> : undefined}
            description="Pagos a empleados o terceros por este proyecto (sin proveedor, ITBIS ni retenciones). A un empleado se le paga aparte de la nómina."
              action={
                canIncentives && !isCancelled ? (
                  <Link href={`/projects/${project.id}/incentives/new`}>
                    <Button variant="outline" size="sm" icon={<Plus size={14} />} hint="Registrar un incentivo por este proyecto: monto fijo o % de la ganancia antes de incentivos.">
                      Nuevo incentivo
                    </Button>
                  </Link>
                ) : undefined
              }
          >
            {!incentives || incentives.length === 0 ? (
              <p className="rounded-[var(--radius-md)] border border-dashed border-brand-border px-4 py-3 text-sm text-brand-muted">
                Este proyecto no tiene incentivos.
                {canIncentives ? " Usa «Nuevo incentivo» para registrar uno (monto fijo o % de la ganancia)." : ""}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {incentives.map((inc) => {
                  const isPct = inc.incentive_mode === "PERCENT";
                  const todayAmount = isPct
                    ? incentiveAmountFromPercent(Number(inc.incentive_percent), profitability.gananciaAntesIncentivos)
                    : null;
                  const changed =
                    isPct &&
                    inc.status !== "CANCELLED" &&
                    inc.incentive_base !== null &&
                    Math.abs(Number(inc.incentive_base) - profitability.gananciaAntesIncentivos) >= 0.01;
                  const canRecalc = changed && canIncentives && inc.status === "PENDING" && Number(inc.paid_amount) === 0;
                  return (
                    <Card key={inc.id} className="flex flex-col gap-2 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={withReturnTo(`/expenses/${inc.id}`, `/projects/${project.id}?tab=finanzas`)}
                            className="font-medium text-brand-text hover:text-brand-accent"
                          >
                            {inc.incentive_recipient}
                          </Link>
                          <span className="ml-2 text-xs text-brand-muted">
                            {RECIPIENT_TYPE_LABELS[inc.incentive_recipient_type ?? ""] ?? ""} · {inc.incentive_reason}
                          </span>
                          <p className="text-xs text-brand-muted">
                            {formatDate(inc.expense_date)} ·{" "}
                            {isPct
                              ? `${Number(inc.incentive_percent)} % de ${formatMoney(Number(inc.incentive_base))} (ganancia antes de incentivos al calcularlo)`
                              : "Monto fijo"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge status={inc.status}>{EXPENSE_STATUS_LABELS[inc.status] ?? inc.status}</Badge>
                          <span className="font-semibold tabular-nums text-brand-text">{formatMoney(Number(inc.total))}</span>
                        </div>
                      </div>
                      {changed && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] bg-brand-warning-bg px-3 py-2 text-xs text-brand-text">
                          <span>
                            La ganancia cambió desde que se calculó: hoy es {formatMoney(profitability.gananciaAntesIncentivos)}
                            {todayAmount !== null
                              ? ` y el ${Number(inc.incentive_percent)} % sería ${formatMoney(todayAmount)}.`
                              : ", y no alcanza para calcular el %."}
                            {inc.status !== "PENDING" || Number(inc.paid_amount) > 0
                              ? " Como ya tiene pagos, no se cambia."
                              : " El monto no cambia solo."}
                          </span>
                          {canRecalc && todayAmount !== null && <RecalcIncentiveButton expenseId={inc.id} />}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </FoldableSection>
          <p className="text-xs text-brand-muted">
            La utilidad y el margen se calculan sin ITBIS: el ITBIS que cobras es de la DGII y el
            de tus compras no es costo. Todos los montos se consolidan en la moneda base de la
            empresa, usando la tasa de cambio ya congelada de cada factura, gasto o cobro (nunca la
            tasa actual).
          </p>
        </div>
      ) : activeTab === "ventas" && quotations && invoices && customerPayments ? (
        <div className="flex flex-col gap-4">
          <BillingNotice progress={billing} context="project" />
          <FoldableSection
            storageKey="proyecto.ventas.cotizaciones"
            title="Cotizaciones"
            icon={<FileText size={16} />}
            count={quotations.length}
            info="Las cotizaciones de este proyecto. Las aprobadas son lo que el cliente aceptó (lo «cotizado»)."
          >
            <DataTable columns={quotationColumns} rows={quotations} keyFor={(q) => q.id} emptyMessage="Sin cotizaciones ligadas." maxWidth="max-w-none" />
          </FoldableSection>
          <FoldableSection
            storageKey="proyecto.ventas.facturas"
            title="Facturas"
            icon={<Receipt size={16} />}
            count={invoices.length}
            info="Las facturas de este proyecto (anticipo, balance, adicionales). Las canceladas salen en gris: no se cobran."
            summary={
              porCobrar > 0 ? (
                <span className="text-xs font-medium text-brand-warning">Por cobrar {formatMoney(porCobrar)}</span>
              ) : undefined
            }
            action={
              <Link href={`/invoices/new?project_id=${project.id}&return_to=${encodeURIComponent(`/projects/${project.id}?tab=ventas`)}`}>
                <Button variant="outline" size="sm" icon={<Plus size={14} />}>
                  Nueva factura
                </Button>
              </Link>
            }
          >
            <DataTable columns={invoiceColumns} rows={invoices} keyFor={(i) => i.id} emptyMessage="Sin facturas todavía." maxWidth="max-w-none" />
          </FoldableSection>
          <FoldableSection
            storageKey="proyecto.ventas.cobros"
            title="Cobros recibidos"
            icon={<Wallet size={16} />}
            count={customerPayments.length}
            info="El dinero que el cliente ya pagó por este proyecto, con la fecha y la cuenta donde entró."
            summary={<span className="text-xs text-brand-muted">Cobrado {formatMoney(profitability.cobrado)}</span>}
          >
            <DataTable columns={paymentColumns} rows={customerPayments} keyFor={(p) => p.id} emptyMessage="Sin cobros todavía." maxWidth="max-w-none" />
          </FoldableSection>
        </div>
      ) : activeTab === "compras" && expenses && projectSuppliers && supplierPayments ? (
        <div className="flex flex-col gap-4">
          <FoldableSection
            storageKey="proyecto.compras.gastos"
            title="Gastos"
            icon={<ShoppingCart size={16} />}
            count={expenses.length}
            info="Todo lo gastado en este proyecto (incluidos los incentivos). Para pagar uno, ábrelo y usa «Registrar pago»."
            summary={<span className="text-xs text-brand-muted">Sin ITBIS {formatMoney(profitability.costoReal + profitability.incentivos)}</span>}
              action={
                <div className="flex flex-wrap gap-2">
                  {canIncentives && !isCancelled && (
                    <Link href={`/projects/${id}/incentives/new`}>
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Plus size={14} />}
                        hint="Pago a un empleado o tercero por este proyecto, sin proveedor ni retenciones. Se ve en Finanzas, después de los gastos."
                      >
                        Nuevo incentivo
                      </Button>
                    </Link>
                  )}
                  <Link
                    href={`/expenses/new?project_id=${id}&return_to=${encodeURIComponent(`/projects/${id}?tab=compras`)}`}
                  >
                    <Button variant="outline" size="sm" icon={<Plus size={14} />}>
                      Nuevo gasto
                    </Button>
                  </Link>
                </div>
              }
          >
            <DataTable columns={expenseColumns} rows={expenses} keyFor={(e) => e.id} emptyMessage="Sin gastos todavía." maxWidth="max-w-none" />
          </FoldableSection>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <div className="xl:col-span-2">
            <FoldableSection
              storageKey="proyecto.compras.proveedores"
              title="Proveedores"
              icon={<Truck size={16} />}
              count={projectSuppliers.length}
              info="Los proveedores de los gastos de este proyecto y cuánto se les ha comprado."
            >
              <DataTable
                columns={supplierColumns}
                rows={projectSuppliers}
                keyFor={(s) => s.supplierId}
                emptyMessage="Sin proveedores asociados a gastos de este proyecto."
                maxWidth="max-w-none"
              />
            </FoldableSection>
            </div>
            <div className="xl:col-span-3">
            <FoldableSection
              storageKey="proyecto.compras.pagos"
              title="Pagos a proveedores"
              icon={<Wallet size={16} />}
              count={supplierPayments.length}
              info="El dinero que ya salió para pagar los gastos de este proyecto."
            >
              <DataTable
                columns={supplierPaymentColumns}
                rows={supplierPayments}
                keyFor={(p) => p.id}
                emptyMessage="Sin pagos todavía."
                maxWidth="max-w-none"
              />
            </FoldableSection>
            </div>
          </div>
        </div>
      ) : activeTab === "bancos" && bankTransactions ? (
        <FoldableSection
          storageKey="proyecto.bancos.movimientos"
          title="Movimientos bancarios"
          icon={<Landmark size={16} />}
          count={bankTransactions.length}
          info="Todo el dinero que entró o salió de los bancos ligado a este proyecto (cobros, pagos y movimientos manuales)."
        >
          <DataTable columns={bankColumns} rows={bankTransactions} keyFor={(t) => t.id} emptyMessage="Sin movimientos todavía." maxWidth="max-w-none" />
        </FoldableSection>
      ) : activeTab === "documentos" && documents ? (
        <div className="max-w-3xl">
        <FoldableSection
          storageKey="proyecto.documentos"
          title="Documentos"
          icon={<Paperclip size={16} />}
          count={documents.length}
          description="Contratos, facturas de proveedores, planos, fotos…"
          info="Archivos del evento guardados en el sistema. Súbelos aquí para tenerlos a mano."
        >
          <div className="flex flex-col gap-4">
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
        </FoldableSection>
        </div>
      ) : activeTab === "tareas" && projectTasks ? (
        <FoldableSection
          storageKey="proyecto.tareas"
          title="Tareas"
          icon={<ListChecks size={16} />}
          count={projectTasks.length}
          info="Pendientes del evento con responsable y fecha límite. Las del proyecto también salen en el menú Tareas."
        >
          <div className="flex flex-col gap-4">
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
        </FoldableSection>
      ) : activeTab === "actividades" && projectActivities ? (
        <div className="max-w-3xl">
        <FoldableSection
          storageKey="proyecto.actividades"
          title="Actividades"
          icon={<MessageSquare size={16} />}
          count={projectActivities.length}
          description="Llamadas, reuniones, visitas y notas del evento."
          info="Bitácora del evento: lo que se habló o se hizo y cuándo. Sirve para que todo el equipo esté al día."
        >
          <div className="flex flex-col gap-4">
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
        </FoldableSection>
        </div>
      ) : activeTab === "satisfaccion" ? (
        <ProjectSurveyPanel projectId={id} projectStatus={project.status} canSend={canSendSurvey} />
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-brand-border p-8 text-center">
          <p className="text-sm text-brand-muted">Pestaña no encontrada.</p>
        </div>
      )}
    </main>
  );
}
