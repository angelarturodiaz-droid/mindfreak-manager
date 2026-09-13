import { getCompanyUsersWithRoles } from "@/features/settings/queries";

export default async function UsersSettingsPage() {
  const users = await getCompanyUsersWithRoles();

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-brand-primary">Usuarios</h2>
      <p className="mb-4 text-sm text-brand-muted">
        Solo lectura por ahora. Invitar y gestionar usuarios desde aquí queda
        para una ronda dedicada aparte — toca autenticación directamente y
        merece más cuidado (ya tuvimos un incidente real creando el primer
        usuario a mano). Por ahora, nuevos usuarios se crean por SQL,
        documentado en <code>PROJECT_MASTER.md</code>.
      </p>

      <table className="w-full max-w-2xl border-collapse text-sm">
        <thead>
          <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
            <th className="py-2 font-medium">Nombre</th>
            <th className="py-2 font-medium">Correo</th>
            <th className="py-2 font-medium">Roles</th>
            <th className="py-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-brand-muted/10">
              <td className="py-2">{u.full_name ?? "—"}</td>
              <td className="py-2 text-brand-muted">{u.email}</td>
              <td className="py-2 text-brand-muted">
                {u.roles.length > 0 ? u.roles.join(", ") : "—"}
              </td>
              <td className="py-2 text-brand-muted">
                {u.is_active ? "Activo" : "Inactivo"}
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-brand-muted">
                Sin usuarios registrados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
