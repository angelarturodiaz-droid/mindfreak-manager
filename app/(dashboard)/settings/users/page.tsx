import { getCompanyUsersWithRoleIds, listRoles, getUsersEmailConfirmationStatus } from "@/features/users/queries";
import { NewUserForm } from "./new-user-form";
import { UserRolesCell, UserActiveToggle } from "./user-role-editor";
import { InitialsAvatar } from "@/components/ui/page-kit";
import { EditableUserName } from "./editable-user-name";
import { EditableUserEmail } from "./editable-user-email";
import { ResetPasswordButton } from "./reset-password-button";
import { DeleteUserButton } from "./delete-user-button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE, paginate, parsePage } from "@/lib/utils/pagination";


type UserRow = Awaited<ReturnType<typeof getCompanyUsersWithRoleIds>>[number];

export default async function UsersSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = parsePage((await searchParams).page);
  const [users, roles, emailConfirmations] = await Promise.all([
    getCompanyUsersWithRoleIds(),
    listRoles(),
    getUsersEmailConfirmationStatus(),
  ]);

  const columns: Column<UserRow>[] = [
    {
      header: "Usuario",
      accessor: (u) => (
        <div className="flex min-w-[15rem] items-center gap-3">
          <InitialsAvatar name={u.full_name ?? u.email} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium text-brand-text">
              <EditableUserName userId={u.id} fullName={u.full_name} />
            </span>
            <span className="text-xs">
              <EditableUserEmail userId={u.id} email={u.email} isConfirmed={emailConfirmations[u.id] ?? false} />
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Estado",
      info: "Activo: puede entrar. Invitación pendiente: todavía no abrió el correo de invitación ni creó su contraseña (usa «Reenviar» junto al correo si no le llegó). Inactivo: desactivado, no puede entrar.",
      accessor: (u) =>
        !u.is_active ? (
          <Badge tone="danger">Inactivo</Badge>
        ) : (emailConfirmations[u.id] ?? false) ? (
          <Badge tone="success">Activo</Badge>
        ) : (
          <span className="whitespace-nowrap" title="Todavía no abrió el correo de invitación ni creó su contraseña. Puedes reenviarla con «Reenviar» junto al correo.">
            <Badge tone="warning">Invitación pendiente</Badge>
          </span>
        ),
    },
    {
      header: "Roles",
      accessor: (u) => (
        <UserRolesCell userId={u.id} userName={u.full_name ?? u.email} currentRoleIds={u.roleIds} allRoles={roles} />
      ),
    },
    {
      header: "Acciones",
      className: "text-right",
      accessor: (u) => (
        <div className="flex items-center justify-end gap-0.5">
          <ResetPasswordButton userId={u.id} userName={u.full_name ?? u.email} />
          <UserActiveToggle userId={u.id} userName={u.full_name ?? u.email} isActive={u.is_active} />
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
        <DataTable columns={columns} rows={paginate(users, page)} keyFor={(u) => u.id} maxWidth="max-w-5xl" emptyMessage="Sin usuarios registrados." />
      <div className="max-w-5xl">
        <Pagination basePath="/settings/users" page={page} pageSize={PAGE_SIZE} total={users.length} />
      </div>
      </div>

      <section className="max-w-md">
        <h2 className="mb-3 text-sm font-medium text-brand-text">Crear usuario</h2>
        <NewUserForm roles={roles} />
      </section>
    </div>
  );
}
