import Link from "next/link";
import { listServiceCategories, listServices } from "@/features/services/queries";
import { NewCategoryForm } from "./new-category-form";
import { NewServiceForm } from "./new-service-form";

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

export default async function ServicesPage() {
  const [categories, services] = await Promise.all([
    listServiceCategories(),
    listServices(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
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
                className="border border-brand-muted/20 px-3 py-1 text-sm text-brand-text"
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
        <NewServiceForm categories={categories} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Catálogo ({services.length})
        </h2>
        {services.length === 0 ? (
          <p className="text-sm text-brand-muted">Aún no tienes productos ni servicios.</p>
        ) : (
          <table className="w-full max-w-4xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                <th className="py-2 font-medium">Nombre</th>
                <th className="py-2 font-medium">Tipo</th>
                <th className="py-2 font-medium">Categoría</th>
                <th className="py-2 font-medium">Unidad</th>
                <th className="py-2 font-medium">Costo</th>
                <th className="py-2 font-medium">Precio</th>
                <th className="py-2 font-medium">Impuesto</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-b border-brand-muted/10">
                  <td className="py-2">
                    <Link
                      href={`/services/${s.id}`}
                      className="font-medium text-brand-text hover:text-brand-accent"
                    >
                      {s.name}
                    </Link>
                    {!s.is_active && (
                      <span className="ml-2 text-xs text-brand-danger">
                        (inactivo)
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-brand-muted">
                    {TYPE_LABELS[s.type] ?? s.type}
                  </td>
                  <td className="py-2 text-brand-muted">
                    {(s.service_categories as { name: string }[] | null)?.[0]
                      ?.name ?? "—"}
                  </td>
                  <td className="py-2 text-brand-muted">{s.unit || "—"}</td>
                  <td className="py-2 text-brand-muted">
                    {formatMoney(s.default_cost)}
                  </td>
                  <td className="py-2">{formatMoney(s.default_price)}</td>
                  <td className="py-2 text-brand-muted">
                    {s.default_tax_percent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
