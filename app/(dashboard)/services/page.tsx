import Link from "next/link";
import { ChevronRight, Layers, Package, Percent, Search, Wrench } from "lucide-react";
import { listServiceCategories, listServices } from "@/features/services/queries";
import { listTaxRates } from "@/features/tax-rates/queries";
import { NewCategoryForm } from "./new-category-form";
import { NewServiceForm } from "./new-service-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { Chip, FilterPills, StatCard, StatGrid, listHref } from "@/components/ui/page-kit";
import { relationName, relationRow } from "@/lib/utils/relation";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
  }).format(amount);
}

const TYPE_LABELS: Record<string, string> = {
  PRODUCTO: "Producto",
  SERVICIO: "Servicio",
};

function marginPct(price: number, cost: number): number | null {
  return price > 0 ? ((price - cost) / price) * 100 : null;
}

type ServiceRow = Awaited<ReturnType<typeof listServices>>[number];

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const [categories, services, taxRates] = await Promise.all([
    listServiceCategories(),
    listServices(),
    listTaxRates(),
  ]);

  // Filtros de presentación sobre el catálogo ya cargado.
  const type = params.type === "PRODUCTO" || params.type === "SERVICIO" ? params.type : undefined;
  const search = params.q?.trim().toLowerCase() || undefined;
  const filtered = services.filter(
    (s) =>
      (!type || s.type === type) &&
      (!params.category || s.category_id === params.category) &&
      (!search || s.name.toLowerCase().includes(search)),
  );
  const active = services.filter((s) => s.is_active);
  const margins = active
    .map((s) => marginPct(s.default_price, s.default_cost))
    .filter((m): m is number => m !== null);
  const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : null;
  const hasFilters = Boolean(type || params.category || search);

  const columns: Column<ServiceRow>[] = [
    {
      header: "Nombre",
      accessor: (s) => (
        <Link href={`/services/${s.id}`} className="group block min-w-[12rem]">
          <span className={`flex items-center gap-2 font-medium group-hover:text-brand-accent ${s.is_active ? "text-brand-text" : "text-brand-muted"}`}>
            {s.name}
            {!s.is_active && <Badge tone="neutral">Inactivo</Badge>}
          </span>
          <span className="block max-w-xs truncate text-xs text-brand-muted">
            {relationName(s.service_categories) ?? "Sin categoría"}
            {s.unit ? ` · por ${s.unit}` : ""}
          </span>
        </Link>
      ),
    },
    {
      header: "Tipo",
      accessor: (s) => (
        <Badge tone={s.type === "PRODUCTO" ? "info" : "success"}>{TYPE_LABELS[s.type] ?? s.type}</Badge>
      ),
    },
    {
      header: "Costo",
      className: "text-right",
      accessor: (s) => <span className="whitespace-nowrap tabular-nums text-brand-muted">{formatMoney(s.default_cost)}</span>,
    },
    {
      header: "Precio",
      className: "text-right",
      accessor: (s) => <span className="whitespace-nowrap font-medium tabular-nums">{formatMoney(s.default_price)}</span>,
    },
    {
      header: "Margen",
      className: "text-right",
      accessor: (s) => {
        const m = marginPct(s.default_price, s.default_cost);
        if (m === null) return <span className="text-brand-muted">—</span>;
        return (
          <span className="inline-flex justify-end">
            <Chip tone={m < 0 ? "danger" : m < 20 ? "warning" : "success"}>{m.toFixed(0)}%</Chip>
          </span>
        );
      },
    },
    {
      header: "Impuesto",
      accessor: (s) => {
        const r = relationRow<{ name: string; rate: number; treatment: string }>(s.tax_rates);
        return (
          <span className="text-brand-muted">
            {r ? `${r.name} (${r.rate}%)` : "Predeterminado"}
          </span>
        );
      },
    },
    {
      header: "",
      className: "w-8 text-right",
      accessor: (s) => (
        <Link href={`/services/${s.id}`} aria-label={`Abrir ${s.name}`} className="inline-flex text-brand-muted hover:text-brand-accent">
          <ChevronRight size={16} />
        </Link>
      ),
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Productos y Servicios</h1>
        <p className="text-sm text-brand-muted">
          Catálogo que se usa en cotizaciones, proyectos y facturas, con su costo, precio e impuesto por defecto.
        </p>
      </div>

      <StatGrid>
        <StatCard
          label="Servicios"
          value={String(active.filter((s) => s.type === "SERVICIO").length)}
          hint="Activos en el catálogo"
          icon={<Wrench size={20} />}
          tone="green"
        />
        <StatCard
          label="Productos"
          value={String(active.filter((s) => s.type === "PRODUCTO").length)}
          hint="Activos en el catálogo"
          icon={<Package size={20} />}
          tone="blue"
        />
        <StatCard
          label="Categorías"
          value={String(categories.length)}
          hint="Para agrupar el catálogo"
          icon={<Layers size={20} />}
          tone="violet"
        />
        <StatCard
          label="Margen promedio"
          value={avgMargin === null ? "—" : `${avgMargin.toFixed(0)}%`}
          hint="Precio vs. costo por defecto"
          icon={<Percent size={20} />}
          tone="amber"
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterPills
              label="Filtrar por tipo"
              items={[undefined, "SERVICIO", "PRODUCTO"].map((t) => ({
                key: t ?? "all",
                label: t ? (t === "SERVICIO" ? "Servicios" : "Productos") : "Todos",
                count: t ? services.filter((s) => s.type === t).length : services.length,
                active: type === t,
                href: listHref("/services", { type: t, category: params.category, q: params.q }),
              }))}
            />
            <form action="/services" method="get" className="flex flex-wrap items-center gap-2">
              {type && <input type="hidden" name="type" value={type} />}
              <Input
                type="search"
                name="q"
                icon={<Search size={15} />}
                defaultValue={params.q}
                placeholder="Buscar…"
                aria-label="Buscar por nombre"
                className="w-44"
              />
              <AutoSubmitSelect
                name="category"
                defaultValue={params.category ?? ""}
                className="w-44"
                aria-label="Filtrar por categoría"
              >
                <option value="">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </AutoSubmitSelect>
            </form>
          </div>

          {hasFilters && (
            <p className="text-sm text-brand-muted">
              {filtered.length} de {services.length}
              {" · "}
              <Link href="/services" className="text-brand-accent hover:underline">
                Limpiar filtros
              </Link>
            </p>
          )}

          <DataTable
            columns={columns}
            rows={filtered}
            keyFor={(s) => s.id}
            maxWidth="max-w-none"
            emptyMessage={hasFilters ? "No hay productos ni servicios con este filtro." : "Aún no tienes productos ni servicios."}
          />
        </section>

        <aside className="flex flex-col gap-4">
          <Card>
            <p className="mb-3 text-sm font-semibold text-brand-text">Nuevo producto/servicio</p>
            <NewServiceForm categories={categories} taxRates={taxRates} />
          </Card>
          <Card>
            <p className="mb-3 text-sm font-semibold text-brand-text">Categorías</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {categories.length === 0 ? (
                <p className="text-sm text-brand-muted">Sin categorías todavía.</p>
              ) : (
                categories.map((c) => (
                  <Link
                    key={c.id}
                    href={listHref("/services", { category: c.id })}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      params.category === c.id
                        ? "border-brand-accent bg-brand-accent-light text-brand-accent"
                        : "border-brand-border text-brand-text hover:bg-brand-surface-hover"
                    }`}
                  >
                    {c.name}
                    <span className="ml-1.5 text-xs text-brand-muted">
                      {services.filter((s) => s.category_id === c.id).length}
                    </span>
                  </Link>
                ))
              )}
            </div>
            <NewCategoryForm />
          </Card>
        </aside>
      </div>
    </main>
  );
}
