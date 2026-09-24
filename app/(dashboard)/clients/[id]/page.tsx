import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  FileText,
  FolderKanban,
  FolderOpen,
  Hash,
  LayoutDashboard,
  Mail,
  MapPin,
  Phone,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  UserX,
} from "lucide-react";
import { getClient, getClientActivity, listClientContacts } from "@/features/clients/queries";
import {
  convertClientToProspectAction,
  convertClientToClientAction,
  deactivateClientAction,
  reactivateClientAction,
  deleteContactAction,
} from "@/features/clients/actions";
import {
  CLIENT_STAGE_FLOW,
  CLIENT_STAGE_LABELS,
  CLIENT_STAGE_TONE,
  avatarTone,
  initials,
} from "@/features/clients/display";
import {
  COUNTDOWN_CLASSES,
  PROJECT_STATUS_LABELS,
  eventCountdown,
  formatEventDate,
  formatMoney,
} from "@/features/projects/display";
import { ClientEditForm } from "./client-edit-form";
import { NewContactForm } from "./new-contact-form";
import { DocumentList } from "@/components/documents/document-list";
import { UploadDocumentForm } from "@/components/documents/upload-document-form";
import { listDocuments } from "@/features/documents/queries";
import { hasPermission } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ActionButton } from "@/components/ui/action-button";
import { ActionBlock } from "@/components/ui/action-block";
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

const TABS = [
  { key: "resumen", label: "Resumen", icon: LayoutDashboard },
  { key: "cotizaciones", label: "Cotizaciones", icon: FileText },
  { key: "facturas", label: "Facturas", icon: Receipt },
  { key: "proyectos", label: "Proyectos", icon: FolderKanban },
  { key: "documentos", label: "Documentos", icon: FolderOpen },
] as const;

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

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: "warning" | "danger";
}) {
  const color =
    tone === "danger" ? "text-brand-danger" : tone === "warning" ? "text-brand-warning" : "text-brand-text";
  return (
    <Card className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-brand-muted">{label}</p>
      <p className={`text-xl font-semibold tracking-tight tabular-nums ${color}`}>{value}</p>
      {hint && <p className="text-xs text-brand-muted">{hint}</p>}
    </Card>
  );
}

type Activity = Awaited<ReturnType<typeof getClientActivity>>;
type QuotationRow = Activity["quotations"][number];
type InvoiceRow = Activity["invoices"][number];
type ProjectRow = Activity["projects"][number];

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = TABS.some((t) => t.key === tab) ? (tab as string) : "resumen";

  let client;
  try {
    client = await getClient(id);
  } catch {
    notFound();
  }
  if (!client) notFound();

  const [contacts, activity, documents, canManageDocs] = await Promise.all([
    listClientContacts(id),
    getClientActivity(id),
    activeTab === "documentos" ? listDocuments("client", id) : null,
    hasPermission("documents.upload"),
  ]);
  const { totals } = activity;
  const tabCounts: Record<string, number | undefined> = {
    cotizaciones: activity.quotations.length,
    facturas: activity.invoices.length,
    proyectos: activity.projects.length,
  };

  const currentStage = CLIENT_STAGE_FLOW.indexOf(client.stage as (typeof CLIENT_STAGE_FLOW)[number]);
  const clientSince = new Intl.DateTimeFormat("es-DO", {
    month: "long",
    year: "numeric",
    timeZone: "America/Santo_Domingo",
  }).format(new Date(client.created_at));
  const advanceAction = (stage: string) =>
    stage === "PROSPECT"
      ? convertClientToProspectAction.bind(null, client.id)
      : stage === "CLIENT"
        ? convertClientToClientAction.bind(null, client.id)
        : null;

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
    { header: "Emitida", accessor: (inv) => <span className="text-brand-muted">{inv.issue_date}</span> },
    { header: "Vence", accessor: (inv) => <span className="text-brand-muted">{inv.due_date ?? "—"}</span> },
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
        <span
          className={`tabular-nums ${
            inv.status === "OVERDUE"
              ? "font-medium text-brand-danger"
              : inv.balance > 0 && inv.status !== "CANCELLED" && inv.status !== "DRAFT"
                ? "font-medium text-brand-warning"
                : "text-brand-muted"
          }`}
        >
          {formatMoney(inv.balance, inv.currency)}
        </span>
      ),
    },
  ];

  const projectColumns: Column<ProjectRow>[] = [
    {
      header: "Proyecto",
      accessor: (p) => (
        <Link href={`/projects/${p.id}`} className="group block">
          <span className="block font-medium text-brand-text group-hover:text-brand-accent">{p.name}</span>
          <span className="text-xs text-brand-muted">{p.number}</span>
        </Link>
      ),
    },
    {
      header: "Evento",
      accessor: (p) => {
        if (!p.event_date) return <span className="text-brand-muted">Sin fecha</span>;
        const cd = eventCountdown(p.event_date, p.status);
        return (
          <div className="flex flex-col items-start gap-1">
            <span className="whitespace-nowrap">{formatEventDate(p.event_date)}</span>
            {cd && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${COUNTDOWN_CLASSES[cd.tone]}`}>
                {cd.label}
              </span>
            )}
          </div>
        );
      },
    },
    { header: "Estado", accessor: (p) => <Badge status={p.status}>{PROJECT_STATUS_LABELS[p.status] ?? p.status}</Badge> },
    {
      header: "Presupuesto",
      className: "text-right",
      accessor: (p) => <span className="font-medium tabular-nums">{formatMoney(p.budget)}</span>,
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link
        href="/clients"
        className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
      >
        <ArrowLeft size={14} /> Clientes
      </Link>

      {/* Encabezado: quién es y cómo contactarlo */}
      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${
                client.is_active ? avatarTone(client.name) : "bg-brand-surface-hover text-brand-muted"
              }`}
              aria-hidden
            >
              {initials(client.name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-brand-primary">{client.name}</h1>
                <Badge tone={CLIENT_STAGE_TONE[client.stage] ?? "neutral"}>
                  {CLIENT_STAGE_LABELS[client.stage] ?? client.stage}
                </Badge>
                {!client.is_active && <Badge tone="neutral">Inactivo</Badge>}
              </div>
              <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-1.5">
                  <Hash size={15} className="text-brand-muted" aria-hidden />
                  <dt className="sr-only">RNC / Cédula</dt>
                  <dd className={client.tax_id ? "text-brand-text" : "text-brand-muted"}>
                    {client.tax_id ?? "Sin RNC/Cédula"}
                  </dd>
                </div>
                {client.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail size={15} className="text-brand-muted" aria-hidden />
                    <dt className="sr-only">Correo</dt>
                    <dd>
                      <a href={`mailto:${client.email}`} className="text-brand-text hover:text-brand-accent">
                        {client.email}
                      </a>
                    </dd>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone size={15} className="text-brand-muted" aria-hidden />
                    <dt className="sr-only">Teléfono</dt>
                    <dd>
                      <a href={`tel:${client.phone}`} className="text-brand-text hover:text-brand-accent">
                        {client.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={15} className="text-brand-muted" aria-hidden />
                    <dt className="sr-only">Dirección</dt>
                    <dd className="text-brand-text">{client.address}</dd>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <CalendarDays size={15} className="text-brand-muted" aria-hidden />
                  <dt className="sr-only">Registrado</dt>
                  <dd className="text-brand-muted">Desde {clientSince}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/quotations/new?client=${client.id}`}>
              <Button size="sm" icon={<Plus size={14} />}>
                Nueva cotización
              </Button>
            </Link>
            {client.is_active && (
              <ConfirmButton
                label="Desactivar"
                icon={<UserX size={14} />}
                confirmTitle={`¿Desactivar a "${client.name}"?`}
                confirmMessage="Podrás reactivarlo más adelante si hace falta. No borra su historial ni sus datos."
                onConfirm={deactivateClientAction.bind(null, client.id)}
              />
            )}
          </div>
        </div>

        {/* Pipeline comercial */}
        {!client.is_active ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] bg-brand-surface-hover px-4 py-3 text-sm text-brand-muted">
            <span className="inline-flex items-center gap-2 font-medium">
              <UserX size={16} /> Cliente inactivo — no aparece para nuevas cotizaciones ni facturas.
            </span>
            <ActionButton
              label="Reactivar cliente"
              icon={<RotateCcw size={14} />}
              onAction={reactivateClientAction.bind(null, client.id)}
            />
          </div>
        ) : (
          <div className="border-t border-brand-border pt-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-brand-muted">
              Etapa comercial
              <span className="ml-2 font-normal normal-case tracking-normal">
                · haz clic en la siguiente etapa para avanzar (no se puede retroceder)
              </span>
            </p>
            <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {CLIENT_STAGE_FLOW.map((stage, i) => {
                const done = i < currentStage;
                const current = i === currentStage;
                const action = i > currentStage ? advanceAction(stage) : null;
                const content = (
                  <>
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
                    <span
                      className={`text-sm ${current ? "font-semibold text-brand-text" : done ? "text-brand-text" : "text-brand-muted"}`}
                    >
                      {CLIENT_STAGE_LABELS[stage]}
                    </span>
                  </>
                );
                const base =
                  "flex w-full items-center gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 text-left";
                return (
                  <li key={stage}>
                    {action ? (
                      <ActionBlock
                        onAction={action}
                        title={`Avanzar a ${CLIENT_STAGE_LABELS[stage]}`}
                        className={`${base} border-brand-border bg-brand-surface transition-colors hover:border-brand-accent/40 hover:bg-brand-accent-light`}
                      >
                        {content}
                      </ActionBlock>
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

      {/* Relación comercial en números */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Cotizado aprobado"
          value={formatMoney(totals.cotizadoAprobado)}
          hint={`${totals.cotizaciones} ${totals.cotizaciones === 1 ? "cotización" : "cotizaciones"} en total`}
        />
        <MetricCard label="Facturado" value={formatMoney(totals.facturado)} hint="Facturas emitidas (sin borradores ni canceladas)" />
        <MetricCard
          label="Por cobrar"
          value={formatMoney(totals.porCobrar)}
          tone={totals.vencido > 0 ? "danger" : totals.porCobrar > 0 ? "warning" : undefined}
          hint={totals.vencido > 0 ? `${formatMoney(totals.vencido)} vencido` : totals.porCobrar > 0 ? "Nada vencido" : "Al día"}
        />
        <MetricCard
          label="Proyectos activos"
          value={String(totals.proyectosActivos)}
          hint={`${activity.projects.length} ${activity.projects.length === 1 ? "proyecto" : "proyectos"} en total`}
        />
      </section>

      <nav
        aria-label="Secciones del cliente"
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-brand-border px-4 md:mx-0 md:px-0"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          const count = tabCounts[t.key];
          return (
            <Link
              key={t.key}
              href={`/clients/${id}?tab=${t.key}`}
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "border-brand-accent font-medium text-brand-accent"
                  : "border-transparent text-brand-muted hover:text-brand-text"
              }`}
            >
              <Icon size={15} aria-hidden />
              {t.label}
              {count !== undefined && count > 0 && (
                <span className="rounded-full bg-brand-surface-hover px-1.5 text-xs tabular-nums text-brand-muted">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {activeTab === "resumen" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="flex flex-col gap-4 lg:col-span-2">
            <SectionHeader
              title="Contactos"
              count={contacts.length}
              description="Personas con las que tratas en esta empresa."
            />
            {contacts.length === 0 ? (
              <p className="rounded-[var(--radius-lg)] border border-dashed border-brand-border p-6 text-center text-sm text-brand-muted">
                Sin contactos todavía. Agrega el primero abajo.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {contacts.map((contact) => (
                  <Card key={contact.id} className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTone(contact.full_name)}`}
                          aria-hidden
                        >
                          {initials(contact.full_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate text-sm font-medium text-brand-text">
                            {contact.full_name}
                            {contact.is_primary && <Badge tone="info">Principal</Badge>}
                          </p>
                          <p className="truncate text-xs text-brand-muted">{contact.position || "Sin cargo"}</p>
                        </div>
                      </div>
                      <ConfirmButton
                        label="Eliminar"
                        icon={<Trash2 size={14} />}
                        confirmTitle={`¿Eliminar a ${contact.full_name}?`}
                        onConfirm={deleteContactAction.bind(null, contact.id, client.id)}
                      />
                    </div>
                    <div className="flex flex-col gap-1 pl-12 text-sm">
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 truncate text-brand-text hover:text-brand-accent">
                          <Mail size={13} className="text-brand-muted" /> {contact.email}
                        </a>
                      )}
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 text-brand-text hover:text-brand-accent">
                          <Phone size={13} className="text-brand-muted" /> {contact.phone}
                        </a>
                      )}
                      {!contact.email && !contact.phone && (
                        <span className="text-xs text-brand-muted">Sin correo ni teléfono</span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
            <Card>
              <p className="mb-3 text-sm font-medium text-brand-text">Agregar contacto</p>
              <NewContactForm clientId={client.id} />
            </Card>
          </section>

          <section>
            <SectionHeader title="Datos del cliente" description="Nombre, RNC y datos de contacto." />
            <Card>
              <ClientEditForm client={client} />
            </Card>
          </section>
        </div>
      ) : activeTab === "cotizaciones" ? (
        <section>
          <SectionHeader
            title="Cotizaciones"
            count={activity.quotations.length}
            action={
              <Link href={`/quotations/new?client=${client.id}`}>
                <Button variant="outline" size="sm" icon={<Plus size={14} />}>
                  Nueva cotización
                </Button>
              </Link>
            }
          />
          <DataTable
            columns={quotationColumns}
            rows={activity.quotations}
            keyFor={(q) => q.id}
            emptyMessage="Este cliente no tiene cotizaciones todavía."
            maxWidth="max-w-none"
          />
        </section>
      ) : activeTab === "facturas" ? (
        <section>
          <SectionHeader
            title="Facturas"
            count={activity.invoices.length}
            action={
              <Link href={`/invoices/new?client=${client.id}`}>
                <Button variant="outline" size="sm" icon={<Plus size={14} />}>
                  Nueva factura
                </Button>
              </Link>
            }
          />
          <DataTable
            columns={invoiceColumns}
            rows={activity.invoices}
            keyFor={(i) => i.id}
            emptyMessage="Este cliente no tiene facturas todavía."
            maxWidth="max-w-none"
          />
        </section>
      ) : activeTab === "proyectos" ? (
        <section>
          <SectionHeader title="Proyectos" count={activity.projects.length} />
          <DataTable
            columns={projectColumns}
            rows={activity.projects}
            keyFor={(p) => p.id}
            emptyMessage="Este cliente no tiene proyectos todavía."
            maxWidth="max-w-none"
          />
        </section>
      ) : activeTab === "documentos" && documents ? (
        <section className="flex max-w-3xl flex-col gap-4">
          <SectionHeader
            title="Documentos y contratos"
            count={documents.length}
            description="Contratos, acuerdos, identificaciones y otros archivos del cliente."
          />
          {canManageDocs && (
            <UploadDocumentForm
              entityType="client"
              entityId={client.id}
              revalidatePathValue={`/clients/${client.id}`}
            />
          )}
          <DocumentList
            documents={documents}
            canDelete={canManageDocs}
            revalidatePathValue={`/clients/${client.id}`}
          />
        </section>
      ) : null}
    </main>
  );
}
