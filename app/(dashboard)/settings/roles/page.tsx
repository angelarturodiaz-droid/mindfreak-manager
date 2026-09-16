import { listRoles, listPermissions, listRolePermissionMatrix } from "@/features/users/queries";
import { PermissionCheckbox } from "./permission-checkbox";
import { Fragment } from "react";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  SALES: "Ventas",
  FINANCE: "Finanzas",
  OPERATIONS: "Operaciones",
};

export default async function RolesSettingsPage() {
  const [roles, permissions, matrix] = await Promise.all([
    listRoles(),
    listPermissions(),
    listRolePermissionMatrix(),
  ]);

  const grouped = new Map<string, typeof permissions>();
  for (const p of permissions) {
    const list = grouped.get(p.module) ?? [];
    list.push(p);
    grouped.set(p.module, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-brand-primary">Roles y permisos</h2>
        <p className="text-sm text-brand-muted">
          Qué puede hacer cada rol en el sistema. El rol{" "}
          <strong>Administrador</strong> siempre tiene todo activado — no es
          editable, para evitar quedarse sin acceso a Configuración por
          accidente.
        </p>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-brand-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-border bg-brand-background text-left text-xs font-medium uppercase tracking-wide text-brand-muted">
              <th className="sticky left-0 bg-brand-background px-4 py-3">Permiso</th>
              {roles.map((role) => (
                <th key={role.id} className="px-4 py-3 text-center">
                  {ROLE_LABELS[role.name] ?? role.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.entries()).map(([module, perms]) => (
              <Fragment key={module}>
                <tr className="bg-brand-background">
                  <td
                    colSpan={roles.length + 1}
                    className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-muted"
                  >
                    {module}
                  </td>
                </tr>
                {perms.map((perm) => (
                  <tr key={perm.id} className="border-b border-brand-border/60 hover:bg-brand-surface-hover">
                    <td className="sticky left-0 bg-brand-surface px-4 py-2">
                      <p className="text-brand-text">{perm.code}</p>
                      {perm.description && (
                        <p className="text-xs text-brand-muted">{perm.description}</p>
                      )}
                    </td>
                    {roles.map((role) => (
                      <td key={role.id} className="px-4 py-2 text-center">
                        <PermissionCheckbox
                          roleId={role.id}
                          permissionId={perm.id}
                          granted={role.name === "ADMIN" ? true : matrix.has(`${role.id}:${perm.id}`)}
                          disabled={role.name === "ADMIN"}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
