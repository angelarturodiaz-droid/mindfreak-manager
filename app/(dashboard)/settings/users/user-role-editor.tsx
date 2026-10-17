"use client";

import { useState, useTransition } from "react";
import { updateUserRolesAction, toggleUserActiveAction } from "@/features/users/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { isNavigationSignal } from "@/lib/utils/navigation-signal";
import { ResultDialog } from "@/components/ui/result-dialog";

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
  const [result, setResult] = useState<{ tone: "success" | "danger"; title: string; text: string } | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
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
        // redirect() del servidor: la acción salió bien, no es un error.
        if (isNavigationSignal(e)) return;
        toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  function handleToggleActive() {
    setConfirmOff(false);
    startTransition(async () => {
      try {
        const res = await toggleUserActiveAction(userId, isActive);
        if (res.error) setResult({ tone: "danger", title: "No se cambió el usuario", text: res.error });
        else if (res.success) setResult({ tone: "success", title: isActive ? "Usuario desactivado" : "Usuario reactivado", text: res.success });
      } catch (e) {
        // redirect() del servidor: la acción salió bien, no es un error.
        if (isNavigationSignal(e)) return;
        setResult({ tone: "danger", title: "No se cambió el usuario", text: e instanceof Error ? e.message : "No se pudo actualizar." });
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
      <Button
        variant="ghost"
        size="sm"
        loading={isPending}
        onClick={() => (isActive ? setConfirmOff(true) : handleToggleActive())}
        hint={isActive ? "Le quita el acceso al sistema (se puede reactivar)" : "Le devuelve el acceso con su mismo rol"}
      >
        {isActive ? "Desactivar" : "Activar"}
      </Button>
      <ResultDialog
        open={confirmOff}
        tone="warning"
        title="¿Desactivar este usuario?"
        onClose={() => setConfirmOff(false)}
        actions={
          <div className="flex w-full justify-center gap-2">
            <Button variant="ghost" onClick={() => setConfirmOff(false)}>
              No, volver
            </Button>
            <Button variant="danger" onClick={handleToggleActive} data-autofocus>
              Sí, desactivar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-brand-muted">
          Se cierra su acceso de inmediato: no podrá iniciar sesión ni seguir usando una sesión abierta, aunque haya
          marcado «recordar este equipo». Sus datos y su historial no se borran, y lo puedes reactivar cuando quieras.
        </p>
      </ResultDialog>
      <ResultDialog
        open={!!result}
        tone={result?.tone ?? "success"}
        title={result?.title ?? ""}
        onClose={() => setResult(null)}
      >
        <p className="text-sm text-brand-muted">{result?.text}</p>
      </ResultDialog>
    </div>
  );
}
