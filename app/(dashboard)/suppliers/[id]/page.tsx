import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  FolderOpen,
  Hash,
  Landmark,
  LayoutDashboard,
  Mail,
  Phone,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { getSupplier, getSupplierActivity, listSupplierContacts } from "@/features/suppliers/queries";
import { PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { listBankCatalog } from "@/features/bank-catalog/queries";
import {
  deactivateSupplierAction,
  deleteSupplierContactAction,
} from "@/features/suppliers/actions";
import { SupplierEditForm } from "./supplier-edit-form";
import { NewSupplierContactForm } from "./new-contact-form";
import { DocumentList } from "@/components/documents/document-list";
import { UploadDocumentForm } from "@/components/documents/upload-document-form";
import { listDocuments } from "@/features/documents/queries";
import { hasPermission } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { InitialsAvatar, MetricCard, SectionHeader } from "@/components/ui/page-kit";
import { relationRow } from "@/lib/utils/relation";
import { formatDate } from "@/lib/utils/dates";

const EXPENSE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIALLY_PAID: "Pago parcial",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
};

const TABS = [
  { key: "resumen", label: "Resumen", icon: LayoutDashboard },
  { key: "gastos", label: "Gastos", icon: Receipt },
  { key: "pagos", label: "Pagos", icon: ArrowUpRight },
  { key: "documentos", label: "Documentos", icon: FolderOpen },
] as const;

function formatMoney(amount: number, currency = "DOP") {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(amount);
}

type Activity = Awaited<ReturnType<typeof getSupplierActivity>>;
type ExpenseRow = Activity["expenses"][number];
type PaymentRow = Activity["payments"][number];

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = TABS.some((t) => t.key === tab) ? (tab as string) : "resumen";

  let supplier;
  try {
    supplier = await getSupplier(id);
  } catch {
    notFound();
  }
  if (!supplier) notFound();

  const [contacts, documents, canManageDocs, bankCatalog, activity] = await Promise.all([
    listSupplierContacts(id),
    listDocuments("supplier", id),
    hasPermission("documents.upload"),
    listBankCatalog(),
    getSupplierActivity(id),
  ]);
  const { totals } = activity;
  const tabCounts: Record<string, number> = {
    gastos: activity.expenses.length,
    pagos: activity.payments.length,
    documentos: documents.length,
  };

  const expenseColumns: Column<ExpenseRow>[] = [
    { header: "Fecha", accessor: (e) => <span className="whitespace-nowrap text-brand-muted">{formatDate(e.expense_date)}</span> },
    {
      header: "Gasto",
      accessor: (e) => (
        <Link href={`/expenses/${e.id}`} className="font-medium text-brand-text hover:text-brand-accent">
          {e.description}
        </Link>
      ),
    },
    {
      header: "Proyecto",
      accessor: (e) => {
        const p = relationRow<{ number: string; name: string }>(e.projects);
        return p && e.project_id ? (
          <Link href={`/projects/${e.project_id}`} className="text-brand-text hover:text-brand-accent">
            {p.number}
          </Link>
        ) : (
          <span className="text-xs text-brand-muted">Empresa</span>
        );
      },
    },
    { header: "Estado", accessor: (e) => <Badge status={e.status}>{EXPENSE_STATUS_LABELS[e.status] ?? e.status}</Badge> },
    {
      header: "Total",
      className: "text-right",
      accessor: (e) => <span className="whitespace-nowrap font-medium tabular-nums">{formatMoney(e.total, e.currency)}</span>,
    },
    {
      header: "Por pagar",
      className: "text-right",
      accessor: (e) => {
        const open = (e.status === "PENDING" || e.status === "PARTIALLY_PAID") && e.balance > 0;
        return (
          <span className={`whitespace-nowrap tabular-nums ${open ? "font-medium text-brand-warning" : "text-brand-muted"}`}>
            {open ? formatMoney(e.balance, e.currency) : "—"}
          </span>
        );
      },
    },
  ];

  const paymentColumns: Column<PaymentRow>[] = [
    { header: "Fecha", accessor: (p) => <span className="whitespace-nowrap text-brand-muted">{formatDate(p.payment_date)}</span> },
    {
      header: "Gasto",
      accessor: (p) => (
        <Link href={`/expenses/${p.expense_id}`} className="text-brand-accent hover:underline">
          {relationRow<{ description: string }>(p.expenses)?.description ?? "Ver gasto"}
        </Link>
      ),
    },
    { header: "Método", accessor: (p) => <span className="text-brand-muted">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span> },
    {
      header: "Pagado desde",
      accessor: (p) => {
        const a = relationRow<{ name: string; bank_name: string | null }>(p.bank_accounts);
        return <span className="text-brand-muted">{a ? `${a.name}${a.bank_name ? ` (${a.bank_name})` : ""}` : "—"}</span>;
      },
    },
    {
      header: "Monto",
      className: "text-right",
      accessor: (p) => <span className="whitespace-nowrap font-medium tabular-nums">{formatMoney(p.amount, p.currency)}</span>,
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link
        href="/suppliers"
        className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
      >
        <ArrowLeft size={14} /> Proveedores
      </Link>

      <Card className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <InitialsAvatar name={supplier.name} size="lg" muted={!supplier.is_active} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-brand-primary">{supplier.name}</h1>
              {supplier.category && <Badge tone="info">{supplier.category}</Badge>}
              {supplier.service_type && <Badge tone="neutral">{supplier.service_type}</Badge>}
              {!supplier.is_active && <Badge tone="danger">Inactivo</Badge>}
            </div>
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-1.5">
                <Hash size={15} className="text-brand-muted" aria-hidden />
                <dt className="sr-only">RNC / Cédula</dt>
                <dd className={supplier.tax_id ? "text-brand-text" : "text-brand-muted"}>{supplier.tax_id ?? "Sin RNC/Cédula"}</dd>
              </div>
              {supplier.email && (
                <div className="flex items-center gap-1.5">
                  <Mail size={15} className="text-brand-muted" aria-hidden />
                  <dt className="sr-only">Correo</dt>
                  <dd>
                    <a href={`mailto:${supplier.email}`} className="text-brand-text hover:text-brand-accent">{supplier.email}</a>
                  </dd>
                </div>
              )}
              {supplier.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone size={15} className="text-brand-muted" aria-hidden />
                  <dt className="sr-only">Teléfono</dt>
                  <dd>
                    <a href={`tel:${supplier.phone}`} className="text-brand-text hover:text-brand-accent">{supplier.phone}</a>
                  </dd>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Landmark size={15} className="text-brand-muted" aria-hidden />
                <dt className="sr-only">Cuenta bancaria</dt>
                <dd className={supplier.bank_name ? "text-brand-text" : "text-brand-muted"}>
                  {supplier.bank_name
                    ? `${supplier.bank_name}${supplier.bank_account_number ? ` · ${supplier.bank_account_number}` : ""}`
                    : "Sin cuenta bancaria"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
        {supplier.is_active && (
          <ConfirmButton
            label="Desactivar proveedor"
            confirmTitle={`¿Desactivar a "${supplier.name}"?`}
            onConfirm={deactivateSupplierAction.bind(null, supplier.id)}
          />
        )}
      </Card>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total gastado" value={formatMoney(totals.gastado)} hint={`${activity.expenses.length} gastos registrados`} />
        <MetricCard label="Pagado" value={formatMoney(totals.pagado)} tone="success" hint={`${activity.payments.length} pagos`} />
        <MetricCard
          label="Por pagar"
          value={formatMoney(totals.porPagar)}
          tone={totals.porPagar > 0 ? "warning" : undefined}
          hint={totals.porPagar > 0 ? "Saldo pendiente" : "Al día"}
        />
        <MetricCard label="Proyectos" value={String(totals.proyectos)} hint="En los que ha trabajado" />
      </section>

      <nav
        aria-label="Secciones del proveedor"
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-brand-border px-4 md:mx-0 md:px-0"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          const count = tabCounts[t.key];
          return (
            <Link
              key={t.key}
              href={`/suppliers/${id}?tab=${t.key}`}
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                active ? "border-brand-accent font-medium text-brand-accent" : "border-transparent text-brand-muted hover:text-brand-text"
              }`}
            >
              <Icon size={15} aria-hidden />
              {t.label}
              {count !== undefined && count > 0 && (
                <span className="rounded-full bg-brand-surface-hover px-1.5 text-xs tabular-nums text-brand-muted">{count}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {activeTab === "resumen" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="flex flex-col gap-4 lg:col-span-2">
            <SectionHeader title="Contactos" count={contacts.length} description="Personas con las que tratas en este proveedor." />
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
                        <InitialsAvatar name={contact.full_name} />
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
                        onConfirm={deleteSupplierContactAction.bind(null, contact.id, supplier.id)}
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
              <NewSupplierContactForm supplierId={supplier.id} />
            </Card>
          </section>
          <section>
            <SectionHeader title="Datos del proveedor" description="Nombre, RNC, contacto y cuenta bancaria." />
            <Card>
              <SupplierEditForm supplier={supplier} bankCatalog={bankCatalog} />
            </Card>
          </section>
        </div>
      ) : activeTab === "gastos" ? (
        <section>
          <SectionHeader
            title="Gastos"
            count={activity.expenses.length}
            action={
              <Link href="/expenses/new">
                <Button variant="outline" size="sm" icon={<Plus size={14} />}>
                  Nuevo gasto
                </Button>
              </Link>
            }
          />
          <DataTable columns={expenseColumns} rows={activity.expenses} keyFor={(e) => e.id} maxWidth="max-w-none" emptyMessage="Este proveedor no tiene gastos registrados." />
        </section>
      ) : activeTab === "pagos" ? (
        <section>
          <SectionHeader title="Pagos" count={activity.payments.length} description="Para registrar un pago, ve al gasto correspondiente." />
          <DataTable columns={paymentColumns} rows={activity.payments} keyFor={(p) => p.id} maxWidth="max-w-none" emptyMessage="Sin pagos registrados a este proveedor." />
        </section>
      ) : (
        <section className="flex max-w-3xl flex-col gap-4">
          <SectionHeader title="Documentos y contratos" count={documents.length} />
          {canManageDocs && (
            <UploadDocumentForm
              entityType="supplier"
              entityId={supplier.id}
              revalidatePathValue={`/suppliers/${supplier.id}`}
            />
          )}
          <DocumentList
            documents={documents}
            canDelete={canManageDocs}
            revalidatePathValue={`/suppliers/${supplier.id}`}
          />
        </section>
      )}
    </main>
  );
}
