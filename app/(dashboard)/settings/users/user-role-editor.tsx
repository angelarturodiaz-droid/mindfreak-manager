"use client";

import { useState, useTransition } from "react";
import { updateUserRolesAction, toggleUserActiveAction } from "@/features/users/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  SALES: "Ventas",
  FINANCE: "Finanzas",
  OPERATIONS: "Operaciones",
};

type Role = { id: string; name: string };

export function UserRoleEditor({
  userId,
  isActive,
  currentRoleIds,
  allRoles,
}: {
  userId: string;
  isActive: boolean;
  currentRoleIds: string[];
  allRoles: Role[];
}) {
  const [selected, setSelected] = useState<string[]>(currentRoleIds);
  const [isPending, startTransition] = useTransition();
  const changed =
    selected.length !== currentRoleIds.length || !selected.every((id) => currentRoleIds.includes(id));

  function toggle(roleId: string) {
    setSelected((prev) => (prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateUserRolesAction(userId, selected);
        toast.success("Roles actualizados");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  function handleToggleActive() {
    startTransition(async () => {
      try {
        await toggleUserActiveAction(userId, isActive);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo actualizar.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-2">
        {allRoles.map((role) => (
          <label
            key={role.id}
            className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              selected.includes(role.id)
                ? "border-brand-accent bg-brand-accent-light text-brand-accent"
                : "border-brand-border text-brand-muted"
            }`}
          >
            <input
              type="checkbox"
              className="hidden"
              checked={selected.includes(role.id)}
              onChange={() => toggle(role.id)}
            />
            {ROLE_LABELS[role.name] ?? role.name}
          </label>
        ))}
      </div>
      {changed && (
        <Button size="sm" loading={isPending} onClick={handleSave}>
          Guardar
        </Button>
      )}
      <Button variant="ghost" size="sm" loading={isPending} onClick={handleToggleActive}>
        {isActive ? "Desactivar" : "Activar"}
      </Button>
    </div>
  );
}
