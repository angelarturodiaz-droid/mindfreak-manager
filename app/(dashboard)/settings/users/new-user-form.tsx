"use client";

import { useActionState, useState } from "react";
import { UserPlus, Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <Input label="Nombre completo" name="full_name" required />
      <Input label="Correo" name="email" type="email" required />

      <div>
        <label className="text-sm font-medium text-brand-text">Contraseña temporal</label>
        <div className="mt-1 flex gap-2">
          <div className="relative flex-1">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-3 py-2 pr-9 text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent-light"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
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
