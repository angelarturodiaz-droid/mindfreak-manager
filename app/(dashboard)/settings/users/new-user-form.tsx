"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { createUserAction, type ActionState } from "@/features/users/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

type Role = { id: string; name: string; description: string | null };

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  SALES: "Ventas",
  FINANCE: "Finanzas",
  OPERATIONS: "Operaciones",
};

export function NewUserForm({ roles }: { roles: Role[] }) {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <Input label="Nombre completo" name="full_name" required />
      <Input label="Correo" name="email" type="email" required />
      <p className="-mt-2 text-xs text-brand-muted">
        Se le manda un correo de invitación a esta dirección — la persona elige su propia contraseña al aceptarla.
        No se activa hasta que lo haga.
      </p>

      <fieldset>
        <legend className="text-sm font-medium text-brand-text">Roles</legend>
        <div className="mt-1 flex flex-col gap-1.5">
          {roles.map((role) => (
            <label key={role.id} className="flex items-center gap-2 text-sm text-brand-text">
              <input type="checkbox" name="role_ids" value={role.id} />
              {ROLE_LABELS[role.name] ?? role.name}
            </label>
          ))}
        </div>
      </fieldset>

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <Button type="submit" loading={pending} icon={<UserPlus size={14} />}>
        Invitar usuario
      </Button>
    </form>
  );
}
