"use client";

import { useState, useTransition } from "react";
import { Power, PowerOff, Pencil } from "lucide-react";
import { updateUserRolesAction, toggleUserActiveAction } from "@/features/users/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ResultDialog } from "@/components/ui/result-dialog";
import { isNavigationSignal } from "@/lib/utils/navigation-signal";
import { Tooltip } from "@/components/ui/tooltip";

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  SALES: "Ventas",
  FINANCE: "Finanzas",
  OPERATIONS: "Operaciones",
};

type Role = { id: string; name: string };
type Result = { tone: "success" | "danger"; title: string; text: string } | null;

/**
 * Roles del usuario: solo se muestran los que tiene (chips) y un lápiz para
 * cambiarlos en una ventana. Así la fila no se alarga con los 5 roles.
 */
export function UserRolesCell({
  userId,
  userName,
  currentRoleIds,
  allRoles,
}: {
  userId: string;
  userName: string;
  currentRoleIds: string[];
  allRoles: Role[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(currentRoleIds);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<Result>(null);
  const assigned = allRoles.filter((r) => currentRoleIds.includes(r.id));

  function toggle(roleId: string) {
    setSelected((prev) => (prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateUserRolesAction(userId, selected);
        setOpen(false);
        setResult({ tone: "success", title: "Roles actualizados", text: `Los roles de ${userName} quedaron guardados.` });
      } catch (e) {
        if (isNavigationSignal(e)) return;
        setResult({ tone: "danger", title: "No se guardaron los roles", text: e instanceof Error ? e.message : "No se pudo guardar." });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {assigned.length === 0 ? (
        <span className="text-xs text-brand-warning">Sin rol</span>
      ) : (
        assigned.map((r) => (
          <span
            key={r.id}
            className="whitespace-nowrap rounded-full bg-brand-accent-light px-2 py-0.5 text-xs font-medium text-brand-accent"
          >
            {ROLE_LABELS[r.name] ?? r.name}
          </span>
        ))
      )}
      <Tooltip text="Cambiar roles: abre una ventana para marcar qué roles tiene esta persona">
        <button
          type="button"
          onClick={() => {
            setSelected(currentRoleIds);
            setOpen(true);
          }}
          className="rounded p-1 text-brand-muted hover:bg-brand-surface-hover hover:text-brand-accent"
          aria-label={`Cambiar roles de ${userName}`}
        >
          <Pencil size={13} />
        </button>
      </Tooltip>

      {open && (
        <Modal open onClose={() => !isPending && setOpen(false)} title={`Roles de ${userName}`}>
          <div className="flex flex-col gap-4 text-sm">
            <p className="text-brand-muted">
              Marca uno o varios. Lo que puede hacer cada rol se configura en <em>Roles y permisos</em>.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {allRoles.map((role) => (
                <label
                  key={role.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 ${
                    selected.includes(role.id) ? "border-brand-accent bg-brand-accent-light" : "border-brand-border"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(role.id)}
                    onChange={() => toggle(role.id)}
                    className="h-4 w-4 accent-brand-accent"
                  />
                  {ROLE_LABELS[role.name] ?? role.name}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSave} loading={isPending}>
                Guardar roles
              </Button>
            </div>
          </div>
        </Modal>
      )}
      <ResultDialog open={!!result} tone={result?.tone ?? "success"} title={result?.title ?? ""} onClose={() => setResult(null)}>
        <p className="text-sm text-brand-muted">{result?.text}</p>
      </ResultDialog>
    </div>
  );
}

/** Botón Desactivar / Activar (con confirmación al desactivar). */
export function UserActiveToggle({ userId, userName, isActive }: { userId: string; userName: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<Result>(null);
  const [confirmOff, setConfirmOff] = useState(false);

  function handleToggleActive() {
    setConfirmOff(false);
    startTransition(async () => {
      try {
        const res = await toggleUserActiveAction(userId, isActive);
        if (res.error) setResult({ tone: "danger", title: "No se cambió el usuario", text: res.error });
        else if (res.success)
          setResult({ tone: "success", title: isActive ? "Usuario desactivado" : "Usuario reactivado", text: res.success });
      } catch (e) {
        if (isNavigationSignal(e)) return;
        setResult({ tone: "danger", title: "No se cambió el usuario", text: e instanceof Error ? e.message : "No se pudo actualizar." });
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        loading={isPending}
        icon={isActive ? <PowerOff size={15} /> : <Power size={15} />}
        aria-label={isActive ? `Desactivar a ${userName}` : `Activar a ${userName}`}
        hint={isActive ? "Desactivar: le quita el acceso de inmediato (se puede reactivar)" : "Activar: le devuelve el acceso con su mismo rol"}
        onClick={() => (isActive ? setConfirmOff(true) : handleToggleActive())}
        className={isActive ? "text-brand-warning" : "text-brand-success"}
      />
      <ResultDialog
        open={confirmOff}
        tone="warning"
        title={`¿Desactivar a ${userName}?`}
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
      <ResultDialog open={!!result} tone={result?.tone ?? "success"} title={result?.title ?? ""} onClose={() => setResult(null)}>
        <p className="text-sm text-brand-muted">{result?.text}</p>
      </ResultDialog>
    </>
  );
}
