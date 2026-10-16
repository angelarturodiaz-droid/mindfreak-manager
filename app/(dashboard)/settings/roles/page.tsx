import Link from "next/link";
import { ShieldCheck, Lock } from "lucide-react";
import { listRoles, listPermissions, listRolePermissionMatrix } from "@/features/users/queries";
import { InfoHint } from "@/components/ui/info-hint";
import { PermissionCheckbox } from "./permission-checkbox";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  SALES: "Ventas",
  FINANCE: "Finanzas",
  OPERATIONS: "Operaciones",
};

const ROLE_HINTS: Record<string, string> = {
  ADMIN: "Tiene todo. No se puede editar, para no quedarse sin acceso a Configuración.",
  MANAGER: "Dirige la operación: ve casi todo y aprueba.",
  SALES: "Clientes, cotizaciones y facturas.",
  FINANCE: "Cobros, pagos, bancos, gastos y reportes.",
  OPERATIONS: "Proyectos, entregas y proveedores.",
};

/** Nombre del módulo en español y orden en que se muestran (de lo comercial a lo administrativo). */
const MODULES: { key: string; label: string }[] = [
  { key: "clients", label: "Clientes" },
  { key: "quotations", label: "Cotizaciones" },
  { key: "invoices", label: "Facturas" },
  { key: "payments", label: "Cobros" },
  { key: "projects", label: "Proyectos / eventos" },
  { key: "deliveries", label: "Entregas y acuses" },
  { key: "surveys", label: "Encuestas" },
  { key: "expenses", label: "Gastos" },
  { key: "suppliers", label: "Proveedores" },
  { key: "banks", label: "Bancos" },
  { key: "documents", label: "Documentos" },
  { key: "reports", label: "Reportes" },
  { key: "users", label: "Usuarios" },
  { key: "settings", label: "Configuración" },
];

/** "Ver" primero, luego crear/editar, y al final lo delicado. */
const ACTION_ORDER = ["view", "create", "update", "upload", "send", "convert", "import", "approve", "reconcile", "manage", "cancel", "void", "delete"];

export default async function RolesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role: roleParam } = await searchParams;
  const [roles, permissions, matrix] = await Promise.all([
    listRoles(),
    listPermissions(),
    listRolePermissionMatrix(),
  ]);

  const order = Object.keys(ROLE_LABELS);
  const sortedRoles = [...roles].sort(
    (a, b) => (order.indexOf(a.name) + 1 || 99) - (order.indexOf(b.name) + 1 || 99),
  );
  const active =
    sortedRoles.find((r) => r.name === roleParam) ??
    sortedRoles.find((r) => r.name !== "ADMIN") ??
    sortedRoles[0];
  const isAdmin = active?.name === "ADMIN";
  const has = (roleId: string, roleName: string, permId: string) =>
    roleName === "ADMIN" || matrix.has(`${roleId}:${permId}`);

  const known = new Set(MODULES.map((m) => m.key));
  const modules = [
    ...MODULES,
    ...Array.from(new Set(permissions.map((p) => p.module)))
      .filter((m) => !known.has(m))
      .map((m) => ({ key: m, label: m })),
  ]
    .map((m) => ({
      ...m,
      perms: permissions
        .filter((p) => p.module === m.key)
        .sort(
          (a, b) =>
            (ACTION_ORDER.indexOf(a.code.split(".")[1]) + 1 || 99) -
            (ACTION_ORDER.indexOf(b.code.split(".")[1]) + 1 || 99),
        ),
    }))
    .filter((m) => m.perms.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-primary">
          Roles y permisos
          <InfoHint text="Elige un rol arriba y marca o desmarca lo que puede hacer. Cada cambio se guarda solo, al momento. Los usuarios ven el cambio la próxima vez que abran una pantalla. El rol de cada persona se asigna en Configuración → Usuarios." />
        </h2>
        <p className="text-sm text-brand-muted">Elige un rol y marca lo que puede hacer. Se guarda al momento.</p>
      </div>

      {/* Un rol a la vez: así la lista cabe en pantalla sin bajar tanto. */}
      <nav aria-label="Roles" className="flex flex-wrap gap-2">
        {sortedRoles.map((r) => {
          const count = permissions.filter((p) => has(r.id, r.name, p.id)).length;
          const selected = r.id === active?.id;
          return (
            <Link
              key={r.id}
              href={`/settings/roles?role=${r.name}`}
              title={ROLE_HINTS[r.name] ?? r.description ?? undefined}
              className={`flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm transition-colors ${
                selected
                  ? "border-brand-accent bg-brand-accent-light font-medium text-brand-accent"
                  : "border-brand-border bg-brand-surface text-brand-text hover:bg-brand-surface-hover"
              }`}
            >
              {r.name === "ADMIN" ? <Lock size={14} aria-hidden /> : <ShieldCheck size={14} aria-hidden />}
              {ROLE_LABELS[r.name] ?? r.name}
              <span className="rounded-full bg-brand-background px-1.5 text-xs tabular-nums text-brand-muted">
                {count}/{permissions.length}
              </span>
            </Link>
          );
        })}
      </nav>

      {active && (
        <p className="-mt-2 text-sm text-brand-muted">
          <strong className="text-brand-text">{ROLE_LABELS[active.name] ?? active.name}:</strong>{" "}
          {ROLE_HINTS[active.name] ?? active.description ?? ""}
        </p>
      )}

      {active && (
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((m) => {
            const on = m.perms.filter((p) => has(active.id, active.name, p.id)).length;
            return (
              <section
                key={m.key}
                className="rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-3"
              >
                <h3 className="mb-2 flex items-center justify-between text-sm font-semibold text-brand-text">
                  {m.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                      on === m.perms.length
                        ? "bg-brand-success-bg text-brand-success"
                        : on === 0
                          ? "bg-brand-background text-brand-muted"
                          : "bg-brand-accent-light text-brand-accent"
                    }`}
                  >
                    {on === m.perms.length ? "Todo" : on === 0 ? "Nada" : `${on} de ${m.perms.length}`}
                  </span>
                </h3>
                <ul className="flex flex-col gap-1">
                  {m.perms.map((perm) => (
                    <li key={perm.id}>
                      <label
                        className={`flex items-start gap-2 rounded-[var(--radius-md)] px-1.5 py-0.5 text-sm ${
                          isAdmin ? "cursor-not-allowed" : "cursor-pointer hover:bg-brand-surface-hover"
                        }`}
                        title={perm.code}
                      >
                        <span className="pt-0.5">
                          <PermissionCheckbox
                            key={`${active.id}:${perm.id}`}
                            roleId={active.id}
                            permissionId={perm.id}
                            granted={has(active.id, active.name, perm.id)}
                            disabled={isAdmin}
                          />
                        </span>
                        <span className="text-brand-text">{perm.description ?? perm.code}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
