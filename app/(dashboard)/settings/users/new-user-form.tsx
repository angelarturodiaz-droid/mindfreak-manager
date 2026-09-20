"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import { createUserAction, type ActionState } from "@/features/users/actions";
import { Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
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

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let pass = "";
  for (let i = 0; i < 12; i++) {
    pass += chars[Math.floor(Math.random() * chars.length)];
  }
  return pass;
}

export function NewUserForm({ roles }: { roles: Role[] }) {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <Input label="Nombre completo" name="full_name" required />
      <Input label="Correo" name="email" type="email" required />

      <div>
        <div className="flex items-end gap-2">
          <PasswordInput
            label="Contraseña temporal"
            name="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1"
          />
          <Button type="button" variant="outline" size="md" onClick={() => setPassword(generatePassword())}>
            Generar
          </Button>
        </div>
        <p className="mt-1 text-xs text-brand-muted">
          Mínimo 8 caracteres. Compártela con la persona por un canal seguro —
          puede cambiarla después desde su propia cuenta.
        </p>
      </div>

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
        Crear usuario
      </Button>
    </form>
  );
}
