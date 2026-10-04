import Link from "next/link";
import { listServiceTypesWithUsage } from "@/features/supplier-service-types/queries";
import { listCategoryOptions } from "@/features/expense-categories/queries";
import { NewServiceTypeForm } from "./new-service-type-form";
import { ImportServiceTypesForm } from "./import-service-types-form";
import { DeleteServiceTypeButton } from "./delete-service-type-button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { LiveSearchInput } from "@/components/ui/live-search-input";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE, parsePage } from "@/lib/utils/pagination";
import { normalizeCatalogName } from "@/features/supplier-service-types/classification";
import { listFiscalClassifications } from "@/features/fiscal/classification-queries";
import { ServiceTypeClassificationSelect } from "@/components/fiscal/service-type-classification-select";
import { BulkClassification } from "@/components/fiscal/bulk-classification";
import { ClassificationsManager } from "@/components/fiscal/classifications-manager";
import { InfoHint } from "@/components/ui/info-hint";
import { FIELD_HINTS } from "@/lib/ui/field-hints";

type Row = Awaited<ReturnType<typeof listServiceTypesWithUsage>>[number];

export default async function ServiceTypesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; fiscal?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = (params.q ?? "").trim();
  const [all, categories, classifications] = await Promise.all([
    listServiceTypesWithUsage(),
    listCategoryOptions(),
    listFiscalClassifications(),
  ]);
  // Filtro por clasificación fiscal: "none" = sin clasificar.
  const fiscalFilter =
    params.fiscal === "none" || classifications.some((c) => c.id === params.fiscal) ? params.fiscal : undefined;
  const classificationName = (id: string | null) => classifications.find((c) => c.id === id)?.name;
  const unclassified = all.filter((t) => !t.fiscal_classification_id).length;
  const usage: Record<string, number> = {};
  for (const t of all) {
    if (t.fiscal_classification_id) usage[t.fiscal_classification_id] = (usage[t.fiscal_classification_id] ?? 0) + 1;
  }

  // Búsqueda (tipo o categoría, sin importar mayúsculas ni acentos), filtro
  // por categoría y páginas de 25, igual que los demás listados.
  const needle = normalizeCatalogName(search);
  const categoryName = categories.find((c) => c.id === params.category)?.name;
  const filtered = all.filter(
    (t) =>
      (!categoryName || t.categoryName === categoryName) &&
      (!fiscalFilter ||
        (fiscalFilter === "none" ? !t.fiscal_classification_id : t.fiscal_classification_id === fiscalFilter)) &&
      (!needle ||
        normalizeCatalogName(t.name).includes(needle) ||
        normalizeCatalogName(t.categoryName ?? "").includes(needle)),
  );
  const hasFilters = Boolean(search || categoryName || fiscalFilter);
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
      header: "Clasificación fiscal",
      accessor: (t) => (
        <ServiceTypeClassificationSelect
          key={`${t.id}-${t.fiscal_classification_id ?? ""}`}
          serviceTypeId={t.id}
          serviceTypeName={t.name}
          value={t.fiscal_classification_id}
          options={classifications}
        />
      ),
    },
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

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
              Clasificación fiscal <InfoHint text={FIELD_HINTS.fiscalClassification} />
            </p>
            <p className="text-sm text-brand-muted">
              A cada tipo de servicio dile a qué se parece para la DGII (servicio técnico, profesional, alquiler,
              venta de bienes…). Con eso el sistema sabrá qué retenciones aplicar cuando registres un gasto. Aquí
              no se ponen porcentajes: esos viven en las reglas fiscales.
            </p>
          </div>
          {unclassified > 0 ? (
            <Link
              href="/settings/service-types?fiscal=none"
              className="rounded-[var(--radius-md)] bg-brand-warning-bg px-3 py-2 text-sm text-brand-text hover:underline"
            >
              <strong>{unclassified}</strong> tipo{unclassified === 1 ? "" : "s"} sin clasificar →
            </Link>
          ) : (
            <span className="rounded-[var(--radius-md)] bg-brand-success-bg px-3 py-2 text-sm text-brand-success">
              Todos los tipos de servicio están clasificados
            </span>
          )}
        </div>
        <details className="rounded-[var(--radius-md)] border border-brand-border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-brand-text">
            Ver y editar las clasificaciones ({classifications.filter((c) => c.is_active).length} activas)
          </summary>
          <div className="mt-3">
            <ClassificationsManager classifications={classifications} usage={usage} />
          </div>
        </details>
      </Card>

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

      <section className="flex max-w-5xl flex-col gap-3">
        <form action="/settings/service-types" method="get" className="flex flex-wrap items-center gap-2">
          <LiveSearchInput defaultValue={search} placeholder="Buscar tipo de servicio…" ariaLabel="Buscar tipo de servicio o categoría" />
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
          <AutoSubmitSelect
            resetOthers={hasFilters && total === 0}
            name="fiscal"
            defaultValue={fiscalFilter ?? ""}
            className="w-56"
            aria-label="Filtrar por clasificación fiscal"
          >
            <option value="">Toda clasificación fiscal</option>
            <option value="none">Sin clasificar</option>
            {classifications.map((c) => (
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
        {hasFilters && (
          <div className="flex justify-end">
            <BulkClassification
              serviceTypeIds={filtered.map((t) => t.id)}
              description={[
                categoryName && `categoría ${categoryName}`,
                fiscalFilter === "none" ? "sin clasificar" : fiscalFilter ? classificationName(fiscalFilter) : null,
                search && `búsqueda "${search}"`,
              ]
                .filter(Boolean)
                .join(", ")}
              options={classifications}
            />
          </div>
        )}
        <DataTable
          columns={columns}
          rows={types}
          keyFor={(t) => t.id}
          maxWidth="max-w-5xl"
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
          params={{
            q: search || undefined,
            category: categoryName ? params.category : undefined,
            fiscal: fiscalFilter,
          }}
        />
      </section>
    </div>
  );
}
