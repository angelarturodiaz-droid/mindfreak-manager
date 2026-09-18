import { getCompanyUsersWithRoleIds, listRoles, getUsersEmailConfirmationStatus } from "@/features/users/queries";
import { NewUserForm } from "./new-user-form";
import { UserRoleEditor } from "./user-role-editor";
import { EditableUserName } from "./editable-user-name";
import { EditableUserEmail } from "./editable-user-email";
import { ResetPasswordButton } from "./reset-password-button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

type UserRow = Awaited<ReturnType<typeof getCompanyUsersWithRoleIds>>[number];

export default async function UsersSettingsPage() {
  const [users, roles, emailConfirmations] = await Promise.all([
    getCompanyUsersWithRoleIds(),
    listRoles(),
    getUsersEmailConfirmationStatus(),
  ]);

  const columns: Column<UserRow>[] = [
    { header: "Nombre", accessor: (u) => <EditableUserName userId={u.id} fullName={u.full_name} /> },
    {
      header: "Correo",
      accessor: (u) => (
        <EditableUserEmail userId={u.id} email={u.email} isConfirmed={emailConfirmations[u.id] ?? false} />
      ),
    },
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
    {
      header: "",
      accessor: (u) => <ResetPasswordButton userId={u.id} userName={u.full_name ?? u.email} />,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-brand-primary">Usuarios</h2>
        <p className="mb-4 text-sm text-brand-muted">
          Se crean directo desde aquí, con una contraseña temporal — se
          envía un correo de confirmación a la dirección indicada, que la
          persona debe abrir antes de poder entrar (así se comprueba que
          el correo existe de verdad). Si te equivocaste al escribirlo,
          puedes corregirlo haciendo clic sobre el correo en la tabla.
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
