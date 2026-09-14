import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/permissions";
import { listAuditLogs, listAuditEntityTypes } from "@/features/audit/queries";
import { Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

const ENTITY_LABELS: Record<string, string> = {
  client: "Cliente",
  supplier: "Proveedor",
  service: "Producto/Servicio",
  quotation: "Cotización",
  project: "Proyecto",
  invoice: "Factura",
  customer_payment: "Cobro",
  expense: "Gasto",
  supplier_payment: "Pago a proveedor",
  bank_account: "Cuenta bancaria",
  bank_transaction: "Movimiento bancario",
  bank_transfer: "Transferencia bancaria",
  tax_rate: "Tasa de impuesto",
  document: "Documento",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Creó",
  UPDATE: "Actualizó",
  DELETE: "Eliminó",
  ACTIVATE: "Activó",
  DEACTIVATE: "Desactivó",
  RECONCILE: "Concilió",
  UNRECONCILE: "Desconcilió",
  STATUS_CANCELLED: "Canceló",
};

const ACTION_TONES: Record<string, BadgeTone> = {
  CREATE: "success",
  UPDATE: "info",
  DELETE: "danger",
  ACTIVATE: "success",
  DEACTIVATE: "danger",
  RECONCILE: "success",
  UNRECONCILE: "neutral",
  STATUS_CANCELLED: "danger",
};

type LogRow = Awaited<ReturnType<typeof listAuditLogs>>[number];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity_type?: string; action?: string }>;
}) {
  if (!(await hasPermission("settings.manage"))) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const [logs, entityTypes] = await Promise.all([
    listAuditLogs({ entityType: params.entity_type, action: params.action }),
    listAuditEntityTypes(),
  ]);

  const columns: Column<LogRow>[] = [
    {
      header: "Fecha",
      className: "whitespace-nowrap align-top",
      accessor: (log) => new Date(log.created_at).toLocaleString("es-DO"),
    },
    {
      header: "Usuario",
      className: "align-top",
      accessor: (log) => {
        const profileData = log.profiles as
          | { full_name: string | null; email: string }[]
          | { full_name: string | null; email: string }
          | null;
        const profile = Array.isArray(profileData) ? profileData[0] : profileData;
        return <span className="text-brand-muted">{profile?.full_name ?? profile?.email ?? "—"}</span>;
      },
    },
    {
      header: "Acción",
      className: "align-top",
      accessor: (log) => (
        <Badge tone={ACTION_TONES[log.action] ?? "neutral"}>
          {ACTION_LABELS[log.action] ?? log.action}
        </Badge>
      ),
    },
    {
      header: "Entidad",
      className: "align-top",
      accessor: (log) => <span className="text-brand-muted">{ENTITY_LABELS[log.entity_type] ?? log.entity_type}</span>,
    },
    {
      header: "Detalle",
      className: "align-top",
      accessor: (log) => {
        const detail = log.new_values ?? log.old_values;
        return detail ? (
          <pre className="max-h-32 max-w-lg overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-sm)] bg-brand-background p-2 text-xs text-brand-muted">
            {JSON.stringify(detail, null, 2)}
          </pre>
        ) : (
          "—"
        );
      },
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Auditoría</h1>
        <p className="text-sm text-brand-muted">
          Registro inmutable de cambios en el sistema (últimos 200). Nunca se
          edita ni se borra un registro de auditoría.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-2" action="/audit" method="get">
        <Select name="entity_type" defaultValue={params.entity_type ?? ""} className="w-48">
          <option value="">Todas las entidades</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>
              {ENTITY_LABELS[t] ?? t}
            </option>
          ))}
        </Select>
        <Select name="action" defaultValue={params.action ?? ""} className="w-44">
          <option value="">Todas las acciones</option>
          {Object.keys(ACTION_LABELS).map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline" size="md">
          Filtrar
        </Button>
      </form>

      <DataTable
        columns={columns}
        rows={logs}
        keyFor={(log) => log.id}
        emptyMessage="Sin registros que coincidan."
        maxWidth="max-w-none"
      />
    </main>
  );
}
