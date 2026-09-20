import { getCompanyUsersWithRoleIds, listRoles, getUsersEmailConfirmationStatus } from "@/features/users/queries";
import { NewUserForm } from "./new-user-form";
import { UserRoleEditor } from "./user-role-editor";
import { EditableUserName } from "./editable-user-name";
import { EditableUserEmail } from "./editable-user-email";
import { ResetPasswordButton } from "./reset-password-button";
import { DeleteUserButton } from "./delete-user-button";
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
      accessor: (u) => (
        <div className="flex flex-col items-start gap-1.5">
          <ResetPasswordButton userId={u.id} userName={u.full_name ?? u.email} />
          <DeleteUserButton userId={u.id} userName={u.full_name ?? u.email} />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-brand-primary">Usuarios</h2>
        <p className="mb-4 text-sm text-brand-muted">
          Se crean por invitación — la persona recibe un correo, confirma
          que esa dirección es suya y elige su propia contraseña. Si te
          equivocaste al escribir el correo, corrígelo haciendo clic sobre
          él en la tabla (pide tu código de autenticador). Eliminar una
          cuenta también lo pide, y solo funciona si esa cuenta nunca
          registró actividad en el sistema — si ya creó algo, usa
          &ldquo;Desactivar&rdquo; en su lugar.
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
