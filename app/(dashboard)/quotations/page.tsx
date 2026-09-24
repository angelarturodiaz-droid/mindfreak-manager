import Link from "next/link";
import { Copy, FileText, Plus } from "lucide-react";
import { listQuotations } from "@/features/quotations/queries";
import { QUOTATION_STATUSES } from "@/features/quotations/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { listClientOptions } from "@/features/clients/queries";
import { relationName } from "@/lib/utils/relation";
import { parsePage } from "@/lib/utils/pagination";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
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
  const [{ rows: quotations, total, pageSize }, clientOptions] = await Promise.all([
    listQuotations({ status: params.status, clientId: params.client, page }),
    listClientOptions(),
  ]);

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
      accessor: (q) => (
        <span className="text-brand-muted">
          {relationName(q.clients) ?? "—"}
        </span>
      ),
    },
    { header: "Fecha", accessor: (q) => <span className="text-brand-muted">{q.issue_date}</span> },
    { header: "Total", accessor: (q) => formatMoney(q.total, q.currency) },
    {
      header: "Estado",
      accessor: (q) => <Badge status={q.status}>{STATUS_LABELS[q.status] ?? q.status}</Badge>,
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">
            Cotizaciones
          </h1>
          <p className="text-sm text-brand-muted">
            Cotiza a clientes activos o potenciales (leads).
          </p>
        </div>
        <Link href="/quotations/new">
          <Button size="sm" icon={<Plus size={14} />}>
            Nueva cotización
          </Button>
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-2" action="/quotations" method="get">
        <Select name="status" defaultValue={params.status ?? ""} className="w-48">
          <option value="">Todos los estados</option>
          {QUOTATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select name="client" defaultValue={params.client ?? ""} className="w-56">
          <option value="">Todos los clientes</option>
          {clientOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.is_active ? "" : " (inactivo)"}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline" size="md">
          Filtrar
        </Button>
        {(params.status || params.client) && (
          <Link href="/quotations" className="px-2 py-2 text-sm text-brand-muted hover:text-brand-accent">
            Limpiar filtros
          </Link>
        )}
      </form>

      {quotations.length === 0 ? (
        <EmptyState
          icon={<FileText size={28} />}
          title="Aún no tienes cotizaciones que coincidan con este filtro."
          action={
            <Link href="/quotations/new">
              <Button size="sm" icon={<Plus size={14} />}>
                Crear la primera
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <DataTable columns={columns} rows={quotations} keyFor={(q) => q.id} />
          <Pagination
            basePath="/quotations"
            page={page}
            pageSize={pageSize}
            total={total}
            params={{ status: params.status, client: params.client }}
          />
        </div>
      )}
    </main>
  );
}
