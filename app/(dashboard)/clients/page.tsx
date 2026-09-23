import Link from "next/link";
import { Upload, UserPlus, Users } from "lucide-react";
import { listClients } from "@/features/clients/queries";
import {
  convertClientToProspectAction,
  convertClientToClientAction,
  deactivateClientAction,
  reactivateClientAction,
} from "@/features/clients/actions";
import { Button } from "@/components/ui/button";
import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";

type ClientRow = Awaited<ReturnType<typeof listClients>>[number];

const STAGE_LABEL: Record<string, string> = {
  LEAD: "Lead",
  PROSPECT: "Prospecto",
  CLIENT: "Cliente",
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; q?: string }>;
}) {
  const params = await searchParams;
  const stage =
    params.stage === "LEAD" || params.stage === "PROSPECT" || params.stage === "CLIENT"
      ? params.stage
      : undefined;

  const clients = await listClients({ stage, search: params.q });

  const columns: Column<ClientRow>[] = [
    {
      header: "Nombre",
      accessor: (client) => (
        <Link
          href={`/clients/${client.id}`}
          className="font-medium text-brand-text hover:text-brand-accent"
        >
          {client.name}
        </Link>
      ),
    },
    {
      header: "Contacto",
      accessor: (client) => (
        <span className="text-brand-muted">{client.email || client.phone || "—"}</span>
      ),
    },
    {
      // Etapa del pipeline comercial (Lead -> Prospecto -> Cliente).
      // Independiente del Estado (activo/inactivo) — ver columna siguiente.
      header: "Etapa",
      accessor: (client) => (
        <Badge tone={client.stage === "CLIENT" ? "success" : client.stage === "PROSPECT" ? "warning" : "info"}>
          {STAGE_LABEL[client.stage] ?? client.stage}
        </Badge>
      ),
    },
    {
      // Estado operativo (activo/inactivo) — un Lead o Prospecto también
      // puede estar Inactivo sin dejar de ser Lead/Prospecto.
      header: "Estado",
      accessor: (client) => (
        <Badge tone={client.is_active ? "success" : "danger"}>
          {client.is_active ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      header: "",
      className: "text-right",
      accessor: (client) => (
        <div className="flex justify-end gap-3">
          {client.stage === "LEAD" && (
            <ActionLink
              label="Marcar prospecto"
              onAction={convertClientToProspectAction.bind(null, client.id)}
            />
          )}
          {client.stage !== "CLIENT" && (
            <ActionLink
              label="Convertir en cliente"
              onAction={convertClientToClientAction.bind(null, client.id)}
            />
          )}
          {client.is_active ? (
            <ActionLink
              label="Desactivar"
              className="text-sm text-brand-muted hover:text-brand-danger"
              onAction={deactivateClientAction.bind(null, client.id)}
            />
          ) : (
            <ActionLink label="Reactivar" onAction={reactivateClientAction.bind(null, client.id)} />
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
            Clientes potenciales (leads), prospectos y clientes activos.
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
        <Select name="stage" defaultValue={stage ?? ""} className="w-40">
          <option value="">Todas las etapas</option>
          <option value="LEAD">Solo leads</option>
          <option value="PROSPECT">Solo prospectos</option>
          <option value="CLIENT">Solo clientes</option>
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
