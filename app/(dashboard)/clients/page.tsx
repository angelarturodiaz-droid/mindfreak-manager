import Link from "next/link";
import { listClients } from "@/features/clients/queries";
import {
  convertClientToActiveAction,
  deactivateClientAction,
} from "@/features/clients/actions";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const status =
    params.status === "LEAD" || params.status === "ACTIVE"
      ? params.status
      : undefined;

  const clients = await listClients({ status, search: params.q });

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Clientes</h1>
          <p className="text-sm text-brand-muted">
            Clientes potenciales (leads) y clientes activos.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/clients/import"
            className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-text hover:border-brand-accent"
          >
            Importar CSV
          </Link>
          <Link
            href="/clients/new"
            className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Nuevo cliente
          </Link>
        </div>
      </div>

      <form className="flex gap-2" action="/clients" method="get">
        <input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="Buscar por nombre…"
          className="w-64 border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">Todos los estados</option>
          <option value="LEAD">Solo leads</option>
          <option value="ACTIVE">Solo activos</option>
        </select>
        <button
          type="submit"
          className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-text hover:border-brand-accent"
        >
          Filtrar
        </button>
      </form>

      {clients.length === 0 ? (
        <div className="border border-dashed border-brand-muted/30 p-8 text-center">
          <p className="text-sm text-brand-muted">
            Aún no tienes clientes que coincidan con este filtro.
          </p>
          <Link
            href="/clients/new"
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
              <th className="py-2 font-medium">Contacto</th>
              <th className="py-2 font-medium">Estado</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-b border-brand-muted/10">
                <td className="py-3">
                  <Link
                    href={`/clients/${client.id}`}
                    className="font-medium text-brand-text hover:text-brand-accent"
                  >
                    {client.name}
                  </Link>
                  {!client.is_active && (
                    <span className="ml-2 text-xs text-brand-danger">
                      (inactivo)
                    </span>
                  )}
                </td>
                <td className="py-3 text-brand-muted">
                  {client.email || client.phone || "—"}
                </td>
                <td className="py-3">
                  <span
                    className={
                      client.status === "ACTIVE"
                        ? "text-brand-success"
                        : "text-brand-accent"
                    }
                  >
                    {client.status === "ACTIVE" ? "Activo" : "Lead"}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-3">
                    {client.status === "LEAD" && (
                      <form
                        action={convertClientToActiveAction.bind(null, client.id)}
                      >
                        <button
                          type="submit"
                          className="text-brand-accent hover:underline"
                        >
                          Convertir a cliente
                        </button>
                      </form>
                    )}
                    {client.is_active && (
                      <form action={deactivateClientAction.bind(null, client.id)}>
                        <button
                          type="submit"
                          className="text-brand-muted hover:text-brand-danger"
                        >
                          Desactivar
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
