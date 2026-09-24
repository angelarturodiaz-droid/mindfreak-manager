import Link from "next/link";
import { listServiceCategories, listServices } from "@/features/services/queries";
import { listTaxRates } from "@/features/tax-rates/queries";
import { NewCategoryForm } from "./new-category-form";
import { NewServiceForm } from "./new-service-form";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { relationName } from "@/lib/utils/relation";

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

type ServiceRow = Awaited<ReturnType<typeof listServices>>[number];

export default async function ServicesPage() {
  const [categories, services, taxRates] = await Promise.all([
    listServiceCategories(),
    listServices(),
    listTaxRates(),
  ]);

  const columns: Column<ServiceRow>[] = [
    {
      header: "Nombre",
      accessor: (s) => (
        <div className="flex items-center gap-2">
          <Link href={`/services/${s.id}`} className="font-medium text-brand-text hover:text-brand-accent">
            {s.name}
          </Link>
          {!s.is_active && <Badge tone="danger">Inactivo</Badge>}
        </div>
      ),
    },
    { header: "Tipo", accessor: (s) => <Badge tone="info">{TYPE_LABELS[s.type] ?? s.type}</Badge> },
    {
      header: "Categoría",
      accessor: (s) => (
        <span className="text-brand-muted">
          {relationName(s.service_categories) ?? "—"}
        </span>
      ),
    },
    { header: "Unidad", accessor: (s) => <span className="text-brand-muted">{s.unit || "—"}</span> },
    { header: "Costo", accessor: (s) => <span className="text-brand-muted">{formatMoney(s.default_cost)}</span> },
    { header: "Precio", accessor: (s) => formatMoney(s.default_price) },
    {
      header: "Impuesto",
      accessor: (s) => {
        const rate = s.tax_rates as { name: string; rate: number; treatment: string } | { name: string; rate: number; treatment: string }[] | null;
        const r = Array.isArray(rate) ? rate[0] : rate;
        return (
          <span className="text-brand-muted">
            {r ? `${r.name} (${r.rate}%)` : "Predeterminado del catálogo"}
          </span>
        );
      },
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-8 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">
          Productos y Servicios
        </h1>
        <p className="text-sm text-brand-muted">
          Catálogo de productos y servicios que se usarán en cotizaciones,
          proyectos y facturas.
        </p>
      </div>

      <section className="max-w-2xl">
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Categorías
        </h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {categories.length === 0 ? (
            <p className="text-sm text-brand-muted">Sin categorías todavía.</p>
          ) : (
            categories.map((c) => (
              <span
                key={c.id}
                className="rounded-[var(--radius-md)] border border-brand-border px-3 py-1 text-sm text-brand-text"
              >
                {c.name}
              </span>
            ))
          )}
        </div>
        <NewCategoryForm />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Nuevo producto/servicio
        </h2>
        <NewServiceForm categories={categories} taxRates={taxRates} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Catálogo ({services.length})
        </h2>
        {services.length === 0 ? (
          <p className="text-sm text-brand-muted">Aún no tienes productos ni servicios.</p>
        ) : (
          <DataTable columns={columns} rows={services} keyFor={(s) => s.id} maxWidth="max-w-4xl" />
        )}
      </section>
    </main>
  );
}
