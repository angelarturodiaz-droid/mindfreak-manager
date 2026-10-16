import { listRoles, listPermissions, listRolePermissionMatrix } from "@/features/users/queries";
import { InfoHint } from "@/components/ui/info-hint";
import { RolesEditor } from "./roles-editor";

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

  const editorRoles = sortedRoles.map((r) => ({
    id: r.id,
    name: r.name,
    label: ROLE_LABELS[r.name] ?? r.name,
    hint: ROLE_HINTS[r.name] ?? r.description ?? "",
    isAdmin: r.name === "ADMIN",
  }));
  const initial = Object.fromEntries(
    sortedRoles.map((r) => [r.id, permissions.filter((p) => matrix.has(`${r.id}:${p.id}`)).map((p) => p.id)]),
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-primary">
          Roles y permisos
          <InfoHint text="Elige un rol arriba, marca o desmarca lo que puede hacer y pulsa «Guardar cambios» abajo. Puedes cambiar varios roles y guardar todo junto. Los usuarios ven el cambio la próxima vez que abran una pantalla. El rol de cada persona se asigna en Configuración → Usuarios." />
        </h2>
        <p className="text-sm text-brand-muted">Elige un rol, marca lo que puede hacer y pulsa Guardar cambios.</p>
      </div>
      {active && (
        <RolesEditor
          // Al guardar llega lo nuevo del servidor: se vuelve a montar limpio.
          key={JSON.stringify(initial)}
          roles={editorRoles}
          modules={modules.map((m) => ({
            key: m.key,
            label: m.label,
            perms: m.perms.map((p) => ({ id: p.id, code: p.code, description: p.description ?? p.code })),
          }))}
          initial={initial}
          initialRoleId={active.id}
        />
      )}
    </div>
  );
}
