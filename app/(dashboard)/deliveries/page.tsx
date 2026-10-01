import Link from "next/link";
import { FilePen, FileSignature, PackageCheck, Plus, Send } from "lucide-react";
import { listDeliveries, getDeliveryStats } from "@/features/deliveries/queries";
import {
  DELIVERY_STATUSES,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_TONE,
  DELIVERY_TYPES,
  DELIVERY_TYPE_LABELS,
  formatTotal,
  totalQuantity,
} from "@/features/deliveries/schema";
import { listClientOptions } from "@/features/clients/queries";
import { hasPermission, requirePermission } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { LiveSearchInput } from "@/components/ui/live-search-input";
import { FilterPills, InitialsAvatar, StatCard, StatGrid, listHref } from "@/components/ui/page-kit";
import { relationName, relationRow } from "@/lib/utils/relation";
import { parsePage } from "@/lib/utils/pagination";
import { formatDate } from "@/lib/utils/dates";

type Row = Awaited<ReturnType<typeof listDeliveries>>["rows"][number];

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; client?: string; type?: string; q?: string; page?: string }>;
}) {
  await requirePermission("deliveries.view");
  const params = await searchParams;
  const page = parsePage(params.page);
  const status = DELIVERY_STATUSES.includes(params.status as (typeof DELIVERY_STATUSES)[number]) ? params.status : undefined;
  const type = DELIVERY_TYPES.includes(params.type as (typeof DELIVERY_TYPES)[number]) ? params.type : undefined;
  const [{ rows, total, pageSize }, stats, clientOptions, canCreate] = await Promise.all([
    listDeliveries({ status, clientId: params.client, type, q: params.q, page }),
    getDeliveryStats(params.client),
    listClientOptions(),
    hasPermission("deliveries.create"),
  ]);
  const hasFilters = Boolean(status || params.client || type || params.q);
  const noResults = hasFilters && rows.length === 0;

  const columns: Column<Row>[] = [
    {
      header: "Número",
      accessor: (r) => (
        <Link href={`/deliveries/${r.id}`} className="font-medium text-brand-text hover:text-brand-accent">
          {r.number}
        </Link>
      ),
    },
    {
      header: "Cliente",
      accessor: (r) => {
        const name = relationName(r.clients);
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
    { header: "Fecha", accessor: (r) => <span className="whitespace-nowrap text-brand-muted">{formatDate(r.delivery_date)}</span> },
    {
      header: "Qué se entregó",
      accessor: (r) => {
        const items = (r.delivery_receipt_items as { quantity: number }[] | null) ?? [];
        return (
          <span className="whitespace-nowrap text-brand-text">
            {DELIVERY_TYPE_LABELS[r.delivery_type] ?? r.delivery_type}
            <span className="text-brand-muted"> · {formatTotal(totalQuantity(items.map((i) => ({ quantity: Number(i.quantity) }))))}</span>
          </span>
        );
      },
    },
    {
      header: "Referencia",
      accessor: (r) => {
        const project = relationRow<{ number: string }>(r.projects);
        return (
          <span className="line-clamp-2 max-w-72 text-brand-muted">
            {r.reference || (project ? project.number : "—")}
          </span>
        );
      },
    },
    {
      header: "Estado",
      accessor: (r) => (
        <span className="flex items-center gap-1.5">
          <Badge tone={DELIVERY_STATUS_TONE[r.status]}>{DELIVERY_STATUS_LABELS[r.status] ?? r.status}</Badge>
          {r.status === "SIGNED" && (
            <span title="Tiene el acuse firmado adjunto">
              <FileSignature size={14} className="text-brand-success" aria-label="Acuse firmado adjunto" />
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Entregas y acuses</h1>
          <p className="text-sm text-brand-muted">
            Documentos, equipos o materiales entregados a clientes, con su acuse de recibo firmado.
          </p>
        </div>
        {canCreate && (
          <Link href="/deliveries/new">
            <Button size="sm" icon={<Plus size={14} />}>
              Nuevo acuse
            </Button>
          </Link>
        )}
      </div>

      <StatGrid>
        <StatCard label="Acuses" value={String(stats.total)} hint="Todos los registrados" icon={<PackageCheck size={20} />} tone="blue" />
        <StatCard
          label="Pendientes de firma"
          value={String(stats.byStatus.ISSUED ?? 0)}
          valueTone={(stats.byStatus.ISSUED ?? 0) > 0 ? "warning" : undefined}
          hint="Entregados, falta adjuntar el firmado"
          icon={<Send size={20} />}
          tone="amber"
        />
        <StatCard
          label="Firmados"
          value={String(stats.byStatus.SIGNED ?? 0)}
          hint={`${stats.signedThisMonth} este mes`}
          icon={<FileSignature size={20} />}
          tone="green"
        />
        <StatCard label="Borradores" value={String(stats.byStatus.DRAFT ?? 0)} hint="Aún sin imprimir para firma" icon={<FilePen size={20} />} tone="neutral" />
      </StatGrid>

      <section className="flex flex-col gap-4">
        <FilterPills
          label="Filtrar por estado"
          items={[undefined, ...DELIVERY_STATUSES].map((s) => ({
            key: s ?? "all",
            label: s ? DELIVERY_STATUS_LABELS[s] : "Todos",
            count: s ? stats.byStatus[s] ?? 0 : stats.total,
            active: status === s,
            // Sin resultados: elegir otro estado busca solo por ese.
            href: listHref(
              "/deliveries",
              noResults ? { status: s } : { status: s, client: params.client, type, q: params.q },
            ),
          }))}
        />
        <form action="/deliveries" method="get" className="flex flex-wrap items-center gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <LiveSearchInput defaultValue={params.q ?? ""} placeholder="Buscar número, referencia…" ariaLabel="Buscar acuse" className="w-60" />
          <AutoSubmitSelect resetOthers={noResults} name="client" defaultValue={params.client ?? ""} className="w-56" aria-label="Filtrar por cliente">
            <option value="">Todos los clientes</option>
            {clientOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.is_active ? "" : " (inactivo)"}
              </option>
            ))}
          </AutoSubmitSelect>
          <AutoSubmitSelect resetOthers={noResults} name="type" defaultValue={type ?? ""} className="w-44" aria-label="Filtrar por tipo">
            <option value="">Todos los tipos</option>
            {DELIVERY_TYPES.map((t) => (
              <option key={t} value={t}>
                {DELIVERY_TYPE_LABELS[t]}
              </option>
            ))}
          </AutoSubmitSelect>
          {hasFilters && (
            <Link href="/deliveries" className="px-2 text-sm text-brand-accent hover:underline">
              Limpiar filtros
            </Link>
          )}
        </form>

        {rows.length === 0 ? (
          <EmptyState
            filtered={hasFilters}
            clearHref="/deliveries"
            what="acuses"
            icon={<PackageCheck size={28} />}
            title={hasFilters ? "No hay acuses que coincidan con este filtro." : "Aún no tienes acuses de entrega."}
            action={
              canCreate ? (
                <Link href="/deliveries/new">
                  <Button size="sm" icon={<Plus size={14} />}>
                    Nuevo acuse
                  </Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            <DataTable columns={columns} rows={rows} keyFor={(r) => r.id} maxWidth="max-w-none" />
            <Pagination
              basePath="/deliveries"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ status, client: params.client, type, q: params.q }}
            />
          </div>
        )}
      </section>
    </main>
  );
}
