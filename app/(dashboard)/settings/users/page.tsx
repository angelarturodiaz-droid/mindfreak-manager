import { getCompanyUsersWithRoles } from "@/features/settings/queries";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

type UserRow = Awaited<ReturnType<typeof getCompanyUsersWithRoles>>[number];

export default async function UsersSettingsPage() {
  const users = await getCompanyUsersWithRoles();

  const columns: Column<UserRow>[] = [
    { header: "Nombre", accessor: (u) => u.full_name ?? "—" },
    { header: "Correo", accessor: (u) => <span className="text-brand-muted">{u.email}</span> },
    {
      header: "Roles",
      accessor: (u) => <span className="text-brand-muted">{u.roles.length > 0 ? u.roles.join(", ") : "—"}</span>,
    },
    {
      header: "Estado",
      accessor: (u) => <Badge tone={u.is_active ? "success" : "danger"}>{u.is_active ? "Activo" : "Inactivo"}</Badge>,
    },
  ];

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

      <DataTable columns={columns} rows={users} keyFor={(u) => u.id} maxWidth="max-w-2xl" emptyMessage="Sin usuarios registrados." />
    </div>
  );
}
