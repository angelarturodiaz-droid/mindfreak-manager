import { getCompanyUsersWithRoleIds, listRoles } from "@/features/users/queries";
import { NewUserForm } from "./new-user-form";
import { UserRoleEditor } from "./user-role-editor";
import { EditableUserName } from "./editable-user-name";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

type UserRow = Awaited<ReturnType<typeof getCompanyUsersWithRoleIds>>[number];

export default async function UsersSettingsPage() {
  const [users, roles] = await Promise.all([getCompanyUsersWithRoleIds(), listRoles()]);

  const columns: Column<UserRow>[] = [
    { header: "Nombre", accessor: (u) => <EditableUserName userId={u.id} fullName={u.full_name} /> },
    { header: "Correo", accessor: (u) => <span className="text-brand-muted">{u.email}</span> },
    {
      header: "Estado",
      accessor: (u) => <Badge tone={u.is_active ? "success" : "danger"}>{u.is_active ? "Activo" : "Inactivo"}</Badge>,
    },
    {
      header: "Roles",
      accessor: (u) => (
        <UserRoleEditor userId={u.id} isActive={u.is_active} currentRoleIds={u.roleIds} allRoles={roles} />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-brand-primary">Usuarios</h2>
        <p className="mb-4 text-sm text-brand-muted">
          Se crean directo desde aquí, con una contraseña temporal — sin
          correo de invitación. Comparte la contraseña con la persona por un
          canal seguro; puede cambiarla luego desde su propia cuenta.
        </p>
        <DataTable columns={columns} rows={users} keyFor={(u) => u.id} maxWidth="max-w-4xl" emptyMessage="Sin usuarios registrados." />
      </div>

      <section className="max-w-md">
        <h2 className="mb-3 text-sm font-medium text-brand-text">Crear usuario</h2>
        <NewUserForm roles={roles} />
      </section>
    </div>
  );
}
