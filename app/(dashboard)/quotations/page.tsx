import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { listQuotations } from "@/features/quotations/queries";
import { QUOTATION_STATUSES } from "@/features/quotations/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";

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

type QuotationRow = Awaited<ReturnType<typeof listQuotations>>[number];

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const quotations = await listQuotations(params.status);

  const columns: Column<QuotationRow>[] = [
    {
      header: "Número",
      accessor: (q) => (
        <Link href={`/quotations/${q.id}`} className="font-medium text-brand-text hover:text-brand-accent">
          {q.number}
        </Link>
      ),
    },
    {
      header: "Cliente",
      accessor: (q) => (
        <span className="text-brand-muted">
          {(q.clients as { name: string }[] | null)?.[0]?.name ?? "—"}
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
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
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
        <Button type="submit" variant="outline" size="md">
          Filtrar
        </Button>
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
        <DataTable columns={columns} rows={quotations} keyFor={(q) => q.id} />
      )}
    </main>
  );
}
