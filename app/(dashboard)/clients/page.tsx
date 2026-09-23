import Link from "next/link";
import { Upload, UserPlus, Users } from "lucide-react";
import { listClients } from "@/features/clients/queries";
import {
  convertClientToActiveAction,
  deactivateClientAction,
} from "@/features/clients/actions";
import { Button } from "@/components/ui/button";
import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";

type ClientRow = Awaited<ReturnType<typeof listClients>>[number];

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

  const columns: Column<ClientRow>[] = [
    {
      header: "Nombre",
      accessor: (client) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/clients/${client.id}`}
            className="font-medium text-brand-text hover:text-brand-accent"
          >
            {client.name}
          </Link>
          {!client.is_active && <Badge tone="danger">Inactivo</Badge>}
        </div>
      ),
    },
    {
      header: "Contacto",
      accessor: (client) => (
        <span className="text-brand-muted">{client.email || client.phone || "—"}</span>
      ),
    },
    {
      header: "Estado",
      accessor: (client) => (
        <Badge tone={client.status === "ACTIVE" ? "success" : "info"}>
          {client.status === "ACTIVE" ? "Activo" : "Lead"}
        </Badge>
      ),
    },
    {
      header: "",
      className: "text-right",
      accessor: (client) => (
        <div className="flex justify-end gap-3">
          {client.status === "LEAD" && (
            <ActionLink label="Convertir a cliente" onAction={() => convertClientToActiveAction(client.id)} />
          )}
          {client.is_active && (
            <ActionLink
              label="Desactivar"
              className="text-sm text-brand-muted hover:text-brand-danger"
              onAction={() => deactivateClientAction(client.id)}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Clientes</h1>
          <p className="text-sm text-brand-muted">
            Clientes potenciales (leads) y clientes activos.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/clients/import">
            <Button variant="outline" size="sm" icon={<Upload size={14} />}>
              Importar CSV
            </Button>
          </Link>
          <Link href="/clients/new">
            <Button size="sm" icon={<UserPlus size={14} />}>
              Nuevo cliente
            </Button>
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2" action="/clients" method="get">
        <Input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="Buscar por nombre…"
          className="w-64"
        />
        <Select name="status" defaultValue={status ?? ""} className="w-40">
          <option value="">Todos los estados</option>
          <option value="LEAD">Solo leads</option>
          <option value="ACTIVE">Solo activos</option>
        </Select>
        <Button type="submit" variant="outline" size="md">
          Filtrar
        </Button>
      </form>

      {clients.length === 0 ? (
        <EmptyState
          icon={<Users size={28} />}
          title="Aún no tienes clientes que coincidan con este filtro."
          action={
            <Link href="/clients/new">
              <Button size="sm" icon={<UserPlus size={14} />}>
                Crear el primero
              </Button>
            </Link>
          }
        />
      ) : (
        <DataTable columns={columns} rows={clients} keyFor={(c) => c.id} maxWidth="max-w-4xl" />
      )}
    </main>
  );
}
