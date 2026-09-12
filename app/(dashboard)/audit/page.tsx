import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/permissions";
import { listAuditLogs, listAuditEntityTypes } from "@/features/audit/queries";

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

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Auditoría</h1>
        <p className="text-sm text-brand-muted">
          Registro inmutable de cambios en el sistema (últimos 200). Nunca se
          edita ni se borra un registro de auditoría.
        </p>
      </div>

      <form className="flex gap-2" action="/audit" method="get">
        <select
          name="entity_type"
          defaultValue={params.entity_type ?? ""}
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">Todas las entidades</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>
              {ENTITY_LABELS[t] ?? t}
            </option>
          ))}
        </select>
        <select
          name="action"
          defaultValue={params.action ?? ""}
          className="border border-brand-muted/30 bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
        >
          <option value="">Todas las acciones</option>
          {Object.keys(ACTION_LABELS).map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-text hover:border-brand-accent"
        >
          Filtrar
        </button>
      </form>

      {logs.length === 0 ? (
        <p className="text-sm text-brand-muted">Sin registros que coincidan.</p>
      ) : (
        <table className="w-full max-w-4xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 font-medium">Fecha</th>
              <th className="py-2 font-medium">Usuario</th>
              <th className="py-2 font-medium">Acción</th>
              <th className="py-2 font-medium">Entidad</th>
              <th className="py-2 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const profileData = log.profiles as
                | { full_name: string | null; email: string }[]
                | { full_name: string | null; email: string }
                | null;
              const profile = Array.isArray(profileData) ? profileData[0] : profileData;
              const detail = log.new_values ?? log.old_values;
              return (
                <tr key={log.id} className="border-b border-brand-muted/10 align-top">
                  <td className="py-2 whitespace-nowrap text-brand-muted">
                    {new Date(log.created_at).toLocaleString("es-DO")}
                  </td>
                  <td className="py-2 text-brand-muted">
                    {profile?.full_name ?? profile?.email ?? "—"}
                  </td>
                  <td className="py-2">{ACTION_LABELS[log.action] ?? log.action}</td>
                  <td className="py-2 text-brand-muted">
                    {ENTITY_LABELS[log.entity_type] ?? log.entity_type}
                  </td>
                  <td className="max-w-md py-2 text-xs text-brand-muted">
                    {detail ? (
                      <pre className="whitespace-pre-wrap break-words">
                        {JSON.stringify(detail)}
                      </pre>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
