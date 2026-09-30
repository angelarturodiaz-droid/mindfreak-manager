import Link from "next/link";
import { listServiceTypesWithUsage } from "@/features/supplier-service-types/queries";
import { listCategoryOptions } from "@/features/expense-categories/queries";
import { NewServiceTypeForm } from "./new-service-type-form";
import { ImportServiceTypesForm } from "./import-service-types-form";
import { DeleteServiceTypeButton } from "./delete-service-type-button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/field";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE, parsePage } from "@/lib/utils/pagination";
import { normalizeCatalogName } from "@/features/supplier-service-types/classification";

type Row = Awaited<ReturnType<typeof listServiceTypesWithUsage>>[number];

export default async function ServiceTypesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = (params.q ?? "").trim();
  const [all, categories] = await Promise.all([listServiceTypesWithUsage(), listCategoryOptions()]);

  // Búsqueda (tipo o categoría, sin importar mayúsculas ni acentos), filtro
  // por categoría y páginas de 25, igual que los demás listados.
  const needle = normalizeCatalogName(search);
  const categoryName = categories.find((c) => c.id === params.category)?.name;
  const filtered = all.filter(
    (t) =>
      (!categoryName || t.categoryName === categoryName) &&
      (!needle ||
        normalizeCatalogName(t.name).includes(needle) ||
        normalizeCatalogName(t.categoryName ?? "").includes(needle)),
  );
  const hasFilters = Boolean(search || categoryName);
  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(parsePage(params.page), lastPage);
  const types = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  // Solo las categorías que tienen tipos de servicio, para el filtro.
  const categoriesWithTypes = categories.filter((c) => all.some((t) => t.categoryName === c.name));

  const columns: Column<Row>[] = [
    { header: "Categoría", accessor: (t) => <span className="text-brand-muted">{t.categoryName}</span> },
    { header: "Tipo de servicio", accessor: (t) => <span className="font-medium text-brand-text">{t.name}</span> },
    {
      header: "Proveedores",
      className: "text-right",
      accessor: (t) => <span className="tabular-nums text-brand-muted">{t.supplierCount}</span>,
    },
    {
      header: "",
      className: "text-right",
      accessor: (t) => (
        <DeleteServiceTypeButton serviceTypeId={t.id} name={t.name} supplierCount={t.supplierCount} />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-brand-primary">Tipos de servicio de proveedores</h2>
        <p className="max-w-3xl text-sm text-brand-muted">
          Qué hace cada proveedor, dentro de su categoría. Ej. Audiovisuales → Alquiler de sonido,
          Alquiler de pantallas. Las categorías salen de{" "}
          <Link href="/settings/expense-categories" className="text-brand-accent hover:underline">
            Categorías
          </Link>
          . Al crear o editar un proveedor eliges primero la categoría y luego su tipo de servicio.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <p className="mb-3 text-sm font-semibold text-brand-text">Nuevo tipo de servicio</p>
          <NewServiceTypeForm categories={categories} />
        </Card>
        <Card>
          <p className="mb-3 text-sm font-semibold text-brand-text">Importar varios desde CSV</p>
          <ImportServiceTypesForm />
        </Card>
      </div>

      <section className="flex max-w-4xl flex-col gap-3">
        <form action="/settings/service-types" method="get" className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            name="q"
            icon={<Search size={15} />}
            defaultValue={search}
            placeholder="Buscar tipo de servicio…"
            aria-label="Buscar tipo de servicio o categoría"
            className="w-64"
          />
          <AutoSubmitSelect
            resetOthers={hasFilters && total === 0}
            name="category"
            defaultValue={categoryName ? params.category : ""}
            className="w-60"
            aria-label="Filtrar por categoría"
          >
            <option value="">Todas las categorías</option>
            {categoriesWithTypes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </AutoSubmitSelect>
          {hasFilters && (
            <Link href="/settings/service-types" className="px-2 text-sm text-brand-accent hover:underline">
              Limpiar
            </Link>
          )}
          <span className="ml-auto text-sm text-brand-muted">
            {hasFilters ? `${total} de ${all.length} tipos` : `${all.length} tipos`}
          </span>
        </form>
        <DataTable
          columns={columns}
          rows={types}
          keyFor={(t) => t.id}
          maxWidth="max-w-4xl"
          emptyMessage="Sin tipos de servicio todavía."
          filtered={hasFilters}
          clearHref="/settings/service-types"
          what="tipos de servicio"
        />
        <Pagination
          basePath="/settings/service-types"
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          params={{ q: search || undefined, category: categoryName ? params.category : undefined }}
        />
      </section>
    </div>
  );
}
