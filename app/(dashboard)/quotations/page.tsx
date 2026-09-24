import Link from "next/link";
import { CheckCircle2, Copy, FilePen, FileText, Percent, Plus, Send } from "lucide-react";
import { listQuotations, getQuotationStats } from "@/features/quotations/queries";
import { QUOTATION_STATUSES } from "@/features/quotations/schema";
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
import { daysFromToday, formatDate, pluralDays } from "@/lib/utils/dates";

function formatMoney(amount: number, currency = "DOP") {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(amount);
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  VIEWED: "Vista",
  NEGOTIATING: "Negociando",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
};

type QuotationRow = Awaited<ReturnType<typeof listQuotations>>["rows"][number];

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; client?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const [{ rows: quotations, total, pageSize }, clientOptions, stats] = await Promise.all([
    listQuotations({ status: params.status, clientId: params.client, page }),
    listClientOptions(),
    getQuotationStats(params.client),
  ]);
  const hasFilters = Boolean(params.status || params.client);
  const selectedClientName = params.client
    ? clientOptions.find((c) => c.id === params.client)?.name
    : undefined;

  const columns: Column<QuotationRow>[] = [
    {
      header: "Número",
      accessor: (q) => (
        <Link
          href={`/quotations/${q.id}`}
          className="inline-flex items-center gap-1.5 font-medium text-brand-text hover:text-brand-accent"
        >
          {q.number}
          {q.duplicated_from_id && (
            <span title="Duplicada">
              <Copy size={12} className="text-brand-muted" aria-label="Duplicada" />
            </span>
          )}
        </Link>
      ),
    },
    {
      header: "Cliente",
      accessor: (q) => {
        const name = relationName(q.clients);
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
      header: "Fecha",
      accessor: (q) => <span className="whitespace-nowrap text-brand-muted">{formatDate(q.issue_date)}</span>,
    },
    {
      header: "Validez",
      accessor: (q) => {
        if (!q.valid_until) return <span className="text-brand-muted">—</span>;
        const open = ["DRAFT", "SENT", "VIEWED", "NEGOTIATING"].includes(q.status);
        const d = daysFromToday(q.valid_until);
        return (
          <div className="flex flex-col items-start gap-1">
            <span className="whitespace-nowrap text-brand-muted">{formatDate(q.valid_until)}</span>
            {open && (
              <Chip tone={d < 0 ? "danger" : d <= 3 ? "warning" : "muted"}>
                {d < 0 ? `Venció hace ${pluralDays(-d)}` : d === 0 ? "Vence hoy" : `Quedan ${pluralDays(d)}`}
              </Chip>
            )}
          </div>
        );
      },
    },
    {
      header: "Total",
      className: "text-right",
      accessor: (q) => (
        <span className="whitespace-nowrap font-medium tabular-nums">{formatMoney(q.total, q.currency)}</span>
      ),
    },
    {
      header: "Estado",
      accessor: (q) => <Badge status={q.status}>{STATUS_LABELS[q.status] ?? q.status}</Badge>,
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Cotizaciones</h1>
          <p className="text-sm text-brand-muted">
            Cotiza a clientes activos o potenciales (leads) y dales seguimiento hasta aprobarlas.
          </p>
        </div>
        <Link href="/quotations/new">
          <Button size="sm" icon={<Plus size={14} />}>
            Nueva cotización
          </Button>
        </Link>
      </div>

      <StatGrid>
        <StatCard
          label="En seguimiento"
          value={formatMoney(stats.followUpValue)}
          hint={`${stats.followUpCount} enviadas, vistas o en negociación`}
          icon={<Send size={20} />}
          tone="amber"
        />
        <StatCard
          label="Aprobadas"
          value={formatMoney(stats.approvedValue)}
          hint={`${stats.byStatus.APPROVED ?? 0} cotizaciones`}
          icon={<CheckCircle2 size={20} />}
          tone="green"
        />
        <StatCard
          label="Borradores"
          value={String(stats.byStatus.DRAFT ?? 0)}
          hint="Por completar y enviar"
          icon={<FilePen size={20} />}
          tone="blue"
        />
        <StatCard
          label="Tasa de aprobación"
          value={stats.approvalRate === null ? "—" : `${stats.approvalRate.toFixed(0)}%`}
          hint="Aprobadas vs. rechazadas"
          icon={<Percent size={20} />}
          tone="violet"
        />
      </StatGrid>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterPills
            label="Filtrar por estado"
            items={[undefined, ...QUOTATION_STATUSES].map((s) => ({
              key: s ?? "all",
              label: s ? STATUS_LABELS[s] ?? s : "Todas",
              count: s ? stats.byStatus[s] ?? 0 : stats.total,
              active: (params.status ?? undefined) === s,
              href: listHref("/quotations", { status: s, client: params.client }),
            }))}
          />
          <form action="/quotations" method="get" className="flex items-center gap-2">
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
            {total} {total === 1 ? "cotización" : "cotizaciones"}
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
            <Link href="/quotations" className="text-brand-accent hover:underline">
              Limpiar filtros
            </Link>
          </p>
        )}

        {quotations.length === 0 ? (
          <EmptyState
            icon={<FileText size={28} />}
            title={hasFilters ? "No hay cotizaciones que coincidan con este filtro." : "Aún no tienes cotizaciones."}
            action={
              <Link href="/quotations/new">
                <Button size="sm" icon={<Plus size={14} />}>
                  Nueva cotización
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            <DataTable columns={columns} rows={quotations} keyFor={(q) => q.id} maxWidth="max-w-none" />
            <Pagination
              basePath="/quotations"
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
