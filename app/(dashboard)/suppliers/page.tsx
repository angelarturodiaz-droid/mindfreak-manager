import Link from "next/link";
import { listSuppliers } from "@/features/suppliers/queries";
import { deactivateSupplierAction } from "@/features/suppliers/actions";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const suppliers = await listSuppliers(params.q);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Proveedores</h1>
          <p className="text-sm text-brand-muted">
            Empresas y personas que le proveen servicios a Mindfreak Events.
          </p>
        </div>
        <Link
          href="/suppliers/new"
          className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Nuevo proveedor
        </Link>
      </div>

      <form className="flex gap-2" action="/suppliers" method="get">
        <input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="Buscar por nombre…"
          className="w-64 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
        <button
          type="submit"
          className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-text hover:border-brand-accent"
        >
          Buscar
        </button>
      </form>

      {suppliers.length === 0 ? (
        <div className="border border-dashed border-brand-muted/30 p-8 text-center">
          <p className="text-sm text-brand-muted">
            Aún no tienes proveedores que coincidan con este filtro.
          </p>
          <Link
            href="/suppliers/new"
            className="mt-2 inline-block text-sm text-brand-accent hover:underline"
          >
            Crear el primero
          </Link>
        </div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 font-medium">Nombre</th>
              <th className="py-2 font-medium">Categoría</th>
              <th className="py-2 font-medium">Contacto</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id} className="border-b border-brand-muted/10">
                <td className="py-3">
                  <Link
                    href={`/suppliers/${supplier.id}`}
                    className="font-medium text-brand-text hover:text-brand-accent"
                  >
                    {supplier.name}
                  </Link>
                  {!supplier.is_active && (
                    <span className="ml-2 text-xs text-brand-danger">
                      (inactivo)
                    </span>
                  )}
                </td>
                <td className="py-3 text-brand-muted">{supplier.category || "—"}</td>
                <td className="py-3 text-brand-muted">
                  {supplier.email || supplier.phone || "—"}
                </td>
                <td className="py-3 text-right">
                  {supplier.is_active && (
                    <form action={deactivateSupplierAction.bind(null, supplier.id)}>
                      <button
                        type="submit"
                        className="text-brand-muted hover:text-brand-danger"
                      >
                        Desactivar
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
