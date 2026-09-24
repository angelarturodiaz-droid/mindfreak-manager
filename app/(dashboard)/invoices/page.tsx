import Link from "next/link";
import { Copy, Receipt, Plus } from "lucide-react";
import { listInvoices } from "@/features/invoices/queries";
import { INVOICE_STATUSES } from "@/features/invoices/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { listClientOptions } from "@/features/clients/queries";
import { relationName } from "@/lib/utils/relation";
import { parsePage } from "@/lib/utils/pagination";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitida",
  PARTIALLY_PAID: "Pago parcial",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

type InvoiceRow = Awaited<ReturnType<typeof listInvoices>>["rows"][number];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; client?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const [{ rows: invoices, total, pageSize }, clientOptions] = await Promise.all([
    listInvoices({ status: params.status, clientId: params.client, page }),
    listClientOptions(),
  ]);

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
      accessor: (inv) => (
        <span className="text-brand-muted">
          {relationName(inv.clients) ?? "—"}
        </span>
      ),
    },
    { header: "Vence", accessor: (inv) => <span className="text-brand-muted">{inv.due_date || "—"}</span> },
    { header: "Total", accessor: (inv) => formatMoney(inv.total, inv.currency) },
    { header: "Balance", accessor: (inv) => formatMoney(inv.balance, inv.currency) },
    {
      header: "Estado",
      accessor: (inv) => <Badge status={inv.status}>{STATUS_LABELS[inv.status] ?? inv.status}</Badge>,
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      <form className="flex flex-wrap items-end gap-2" action="/invoices" method="get">
        <Select name="status" defaultValue={params.status ?? ""} className="w-48">
          <option value="">Todos los estados</option>
          {INVOICE_STATUSES.map((s) => (
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
          <Link href="/invoices" className="px-2 py-2 text-sm text-brand-muted hover:text-brand-accent">
            Limpiar filtros
          </Link>
        )}
      </form>

      {invoices.length === 0 ? (
        <EmptyState
          icon={<Receipt size={28} />}
          title="Aún no tienes facturas que coincidan con este filtro."
          action={
            <Link href="/invoices/new">
              <Button size="sm" icon={<Plus size={14} />}>
                Crear la primera
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <DataTable columns={columns} rows={invoices} keyFor={(inv) => inv.id} maxWidth="max-w-4xl" />
          <Pagination
            basePath="/invoices"
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
