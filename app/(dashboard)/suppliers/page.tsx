import Link from "next/link";
import { CalendarCheck, ChevronRight, Landmark, Mail, Phone, Plus, Search, Truck, Upload, Wallet } from "lucide-react";
import {
  listSuppliers,
  getSupplierStats,
  getSupplierListAggregates,
} from "@/features/suppliers/queries";
import { deactivateSupplierAction } from "@/features/suppliers/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Pagination } from "@/components/ui/pagination";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { InitialsAvatar, StatCard, StatGrid } from "@/components/ui/page-kit";
import { parsePage } from "@/lib/utils/pagination";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(amount);
}

type SupplierRow = Awaited<ReturnType<typeof listSuppliers>>["rows"][number];

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.q?.trim() || undefined;
  const status = params.status === "active" || params.status === "inactive" ? params.status : undefined;
  const page = parsePage(params.page);
  const [{ rows: suppliers, total, pageSize }, stats] = await Promise.all([
    listSuppliers({ search, status, page }),
    getSupplierStats(),
  ]);
  const aggregates = await getSupplierListAggregates(suppliers.map((s) => s.id));
  const hasFilters = Boolean(search || status);
  const monthName = new Intl.DateTimeFormat("es-DO", {
    month: "long",
    timeZone: "America/Santo_Domingo",
  }).format(new Date());

  const columns: Column<SupplierRow>[] = [
    {
      header: "Proveedor",
      accessor: (s) => (
        <Link href={`/suppliers/${s.id}`} className="group flex min-w-[14rem] items-center gap-3">
          <InitialsAvatar name={s.name} muted={!s.is_active} />
          <span className="min-w-0">
            <span className={`flex items-center gap-2 truncate font-medium group-hover:text-brand-accent ${s.is_active ? "text-brand-text" : "text-brand-muted"}`}>
              {s.name}
              {!s.is_active && <Badge tone="neutral">Inactivo</Badge>}
            </span>
            <span className="block text-xs text-brand-muted">
              {[s.category, s.service_type].filter(Boolean).join(" · ") || "Sin categoría"}
            </span>
          </span>
        </Link>
      ),
    },
    {
      header: "Contacto",
      accessor: (s) =>
        s.email || s.phone ? (
          <div className="flex flex-col gap-0.5 text-sm">
            {s.email && (
              <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1.5 text-brand-text hover:text-brand-accent">
                <Mail size={13} className="text-brand-muted" /> {s.email}
              </a>
            )}
            {s.phone && (
              <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1.5 text-brand-muted hover:text-brand-accent">
                <Phone size={13} /> {s.phone}
              </a>
            )}
          </div>
        ) : (
          <span className="text-brand-muted">Sin datos de contacto</span>
        ),
    },
    {
      header: "Banco",
      accessor: (s) =>
        s.bank_name ? (
          <span className="inline-flex items-center gap-1.5 text-brand-text">
            <Landmark size={13} className="text-brand-muted" /> {s.bank_name}
          </span>
        ) : (
          <span className="text-brand-muted">—</span>
        ),
    },
    {
      header: "Gastado",
      className: "text-right",
      accessor: (s) => {
        const v = aggregates[s.id]?.gastado ?? 0;
        return <span className={`whitespace-nowrap tabular-nums ${v > 0 ? "text-brand-text" : "text-brand-muted"}`}>{v > 0 ? formatMoney(v) : "—"}</span>;
      },
    },
    {
      header: "Por pagar",
      className: "text-right",
      accessor: (s) => {
        const v = aggregates[s.id]?.porPagar ?? 0;
        return (
          <span className={`whitespace-nowrap tabular-nums ${v > 0 ? "font-medium text-brand-warning" : "text-brand-muted"}`}>
            {v > 0 ? formatMoney(v) : "—"}
          </span>
        );
      },
    },
    {
      header: "",
      className: "text-right",
      accessor: (s) => (
        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          {s.is_active && (
            <ConfirmButton
              label="Desactivar"
              confirmTitle={`¿Desactivar a "${s.name}"?`}
              onConfirm={deactivateSupplierAction.bind(null, s.id)}
            />
          )}
          <Link href={`/suppliers/${s.id}`} aria-label={`Abrir ${s.name}`} className="text-brand-muted hover:text-brand-accent">
            <ChevronRight size={16} />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Proveedores</h1>
          <p className="text-sm text-brand-muted">
            Empresas y personas que le proveen servicios a Mindfreak Events.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/suppliers/import">
            <Button variant="outline" size="sm" icon={<Upload size={14} />}>
              Importar CSV
            </Button>
          </Link>
          <Link href="/suppliers/new">
            <Button size="sm" icon={<Plus size={14} />}>
              Nuevo proveedor
            </Button>
          </Link>
        </div>
      </div>

      <StatGrid>
        <StatCard
          label="Proveedores activos"
          value={String(stats.active)}
          hint={`${stats.inactive} inactivos`}
          icon={<Truck size={20} />}
          tone="blue"
        />
        <StatCard
          label="Por pagar"
          value={formatMoney(stats.porPagar)}
          valueTone={stats.porPagar > 0 ? "warning" : undefined}
          hint={`${stats.porPagarCount} ${stats.porPagarCount === 1 ? "gasto pendiente" : "gastos pendientes"}`}
          icon={<Wallet size={20} />}
          tone="amber"
        />
        <StatCard
          label={`Pagado en ${monthName}`}
          value={formatMoney(stats.pagadoMes)}
          hint="Pagos registrados a proveedores"
          icon={<CalendarCheck size={20} />}
          tone="green"
        />
        <StatCard
          label="Total registrados"
          value={String(stats.total)}
          hint="Activos e inactivos"
          icon={<Landmark size={20} />}
          tone="violet"
        />
      </StatGrid>

      <section className="flex flex-col gap-4">
        <form action="/suppliers" method="get" className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            name="q"
            icon={<Search size={15} />}
            defaultValue={search}
            placeholder="Buscar por nombre…"
            aria-label="Buscar proveedor por nombre"
            className="w-64"
          />
          <AutoSubmitSelect name="status" defaultValue={status ?? ""} className="w-44" aria-label="Filtrar por estado">
            <option value="">Activos e inactivos</option>
            <option value="active">Solo activos</option>
            <option value="inactive">Solo inactivos ({stats.inactive})</option>
          </AutoSubmitSelect>
          {hasFilters && (
            <Link href="/suppliers" className="px-2 text-sm text-brand-accent hover:underline">
              Limpiar filtros
            </Link>
          )}
        </form>

        {hasFilters && (
          <p className="text-sm text-brand-muted">
            {total} {total === 1 ? "resultado" : "resultados"}
            {search && (
              <>
                {" "}para <span className="font-medium text-brand-text">“{search}”</span>
              </>
            )}
          </p>
        )}

        {suppliers.length === 0 ? (
          <EmptyState
            icon={<Truck size={28} />}
            title={hasFilters ? "No hay proveedores que coincidan con este filtro." : "Aún no tienes proveedores."}
            action={
              <Link href="/suppliers/new">
                <Button size="sm" icon={<Plus size={14} />}>
                  Nuevo proveedor
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            <DataTable columns={columns} rows={suppliers} keyFor={(s) => s.id} maxWidth="max-w-none" />
            <Pagination
              basePath="/suppliers"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ q: search, status }}
            />
          </div>
        )}
      </section>
    </main>
  );
}
