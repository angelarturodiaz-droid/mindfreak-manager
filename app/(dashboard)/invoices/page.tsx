import Link from "next/link";
import { AlertTriangle, CalendarClock, Copy, FilePen, Plus, Receipt, Wallet } from "lucide-react";
import { listInvoices, getInvoiceStats } from "@/features/invoices/queries";
import { INVOICE_STATUSES } from "@/features/invoices/schema";
import { listClientOptions } from "@/features/clients/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import {
  Chip,
  FilterPills,
  InitialsAvatar,
  StatCard,
  StatGrid,
  listHref,
} from "@/components/ui/page-kit";
import { relationName } from "@/lib/utils/relation";
import { parsePage } from "@/lib/utils/pagination";
import { dueLabel, formatDate } from "@/lib/utils/dates";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitida",
  PARTIALLY_PAID: "Pago parcial",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

function formatMoney(amount: number, currency = "DOP") {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(amount);
}

type InvoiceRow = Awaited<ReturnType<typeof listInvoices>>["rows"][number];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; client?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const [{ rows: invoices, total, pageSize }, clientOptions, stats] = await Promise.all([
    listInvoices({ status: params.status, clientId: params.client, page }),
    listClientOptions(),
    getInvoiceStats(params.client),
  ]);
  const hasFilters = Boolean(params.status || params.client);
  const selectedClientName = params.client
    ? clientOptions.find((c) => c.id === params.client)?.name
    : undefined;

  const columns: Column<InvoiceRow>[] = [
    {
      header: "Número",
      accessor: (inv) => (
        <Link
          href={`/invoices/${inv.id}`}
          className="inline-flex items-center gap-1.5 font-medium text-brand-text hover:text-brand-accent"
        >
          {inv.number}
          {inv.duplicated_from_id && (
            <span title="Duplicada">
              <Copy size={12} className="text-brand-muted" aria-label="Duplicada" />
            </span>
          )}
        </Link>
      ),
    },
    {
      header: "Cliente",
      accessor: (inv) => {
        const name = relationName(inv.clients);
        return name ? (
          <span className="flex items-center gap-2">
            <InitialsAvatar name={name} size="sm" />
            <span className="text-brand-text">{name}</span>
          </span>
        ) : (
          <span className="text-brand-muted">—</span>
        );
      },
    },
    {
      header: "Emitida",
      accessor: (inv) => <span className="whitespace-nowrap text-brand-muted">{formatDate(inv.issue_date)}</span>,
    },
    {
      header: "Vence",
      accessor: (inv) => {
        if (!inv.due_date) return <span className="text-brand-muted">—</span>;
        const open = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status) && inv.balance > 0;
        const due = open ? dueLabel(inv.due_date) : null;
        return (
          <div className="flex flex-col items-start gap-1">
            <span className="whitespace-nowrap text-brand-muted">{formatDate(inv.due_date)}</span>
            {due && <Chip tone={due.days < 0 ? "danger" : due.days <= 3 ? "warning" : "muted"}>{due.label}</Chip>}
          </div>
        );
      },
    },
    {
      header: "Total",
      className: "text-right",
      accessor: (inv) => (
        <span className="whitespace-nowrap font-medium tabular-nums">{formatMoney(inv.total, inv.currency)}</span>
      ),
    },
    {
      header: "Balance",
      className: "text-right",
      accessor: (inv) => {
        const open = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status) && inv.balance > 0;
        return (
          <span
            className={`whitespace-nowrap tabular-nums ${
              open ? (inv.status === "OVERDUE" ? "font-medium text-brand-danger" : "font-medium text-brand-warning") : "text-brand-muted"
            }`}
          >
            {formatMoney(inv.balance, inv.currency)}
          </span>
        );
      },
    },
    {
      header: "Estado",
      accessor: (inv) => <Badge status={inv.status}>{STATUS_LABELS[inv.status] ?? inv.status}</Badge>,
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Facturas</h1>
          <p className="text-sm text-brand-muted">
            Ligadas a un cliente y, opcionalmente, a un proyecto/evento.
          </p>
        </div>
        <Link href="/invoices/new">
          <Button size="sm" icon={<Plus size={14} />}>
            Nueva factura
          </Button>
        </Link>
      </div>

      <StatGrid>
        <StatCard
          label="Por cobrar"
          value={formatMoney(stats.porCobrar)}
          hint="Balance de facturas abiertas"
          icon={<Wallet size={20} />}
          tone="blue"
        />
        <StatCard
          label="Vencido"
          value={formatMoney(stats.vencido)}
          valueTone={stats.vencido > 0 ? "danger" : undefined}
          hint={`${stats.vencidoCount} ${stats.vencidoCount === 1 ? "factura" : "facturas"} con fecha pasada`}
          icon={<AlertTriangle size={20} />}
          tone="red"
        />
        <StatCard
          label="Vence en 7 días"
          value={formatMoney(stats.dueSoon)}
          hint={`${stats.dueSoonCount} ${stats.dueSoonCount === 1 ? "factura" : "facturas"}`}
          icon={<CalendarClock size={20} />}
          tone="amber"
        />
        <StatCard
          label="Borradores"
          value={String(stats.byStatus.DRAFT ?? 0)}
          hint="Pendientes de emitir"
          icon={<FilePen size={20} />}
          tone="neutral"
        />
      </StatGrid>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterPills
            label="Filtrar por estado"
            items={[undefined, ...INVOICE_STATUSES].map((s) => ({
              key: s ?? "all",
              label: s ? STATUS_LABELS[s] ?? s : "Todas",
              count: s ? stats.byStatus[s] ?? 0 : stats.total,
              active: (params.status ?? undefined) === s,
              href: listHref("/invoices", { status: s, client: params.client }),
            }))}
          />
          <form action="/invoices" method="get" className="flex items-center gap-2">
            {params.status && <input type="hidden" name="status" value={params.status} />}
            <AutoSubmitSelect
              name="client"
              defaultValue={params.client ?? ""}
              className="w-60"
              aria-label="Filtrar por cliente"
            >
              <option value="">Todos los clientes</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.is_active ? "" : " (inactivo)"}
                </option>
              ))}
            </AutoSubmitSelect>
          </form>
        </div>

        {hasFilters && (
          <p className="text-sm text-brand-muted">
            {total} {total === 1 ? "factura" : "facturas"}
            {params.status && (
              <>
                {" "}en <span className="font-medium text-brand-text">{STATUS_LABELS[params.status] ?? params.status}</span>
              </>
            )}
            {selectedClientName && (
              <>
                {" "}de <span className="font-medium text-brand-text">{selectedClientName}</span>
              </>
            )}
            {" · "}
            <Link href="/invoices" className="text-brand-accent hover:underline">
              Limpiar filtros
            </Link>
          </p>
        )}

        {invoices.length === 0 ? (
          <EmptyState
            icon={<Receipt size={28} />}
            title={hasFilters ? "No hay facturas que coincidan con este filtro." : "Aún no tienes facturas."}
            action={
              <Link href="/invoices/new">
                <Button size="sm" icon={<Plus size={14} />}>
                  Nueva factura
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            <DataTable columns={columns} rows={invoices} keyFor={(inv) => inv.id} maxWidth="max-w-none" />
            <Pagination
              basePath="/invoices"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ status: params.status, client: params.client }}
            />
          </div>
        )}
      </section>
    </main>
  );
}
