"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck, Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultDialog } from "@/components/ui/result-dialog";
import { toast } from "@/components/ui/toaster";
import { saveRolePermissionsAction } from "@/features/users/actions";

export type EditorRole = { id: string; name: string; label: string; hint: string; isAdmin: boolean };
export type EditorModule = { key: string; label: string; perms: { id: string; code: string; description: string }[] };

/**
 * Permisos de un rol a la vez, agrupados por módulo. Los cambios quedan
 * pendientes (se pueden marcar en varios roles) hasta pulsar
 * "Guardar cambios"; "Descartar" vuelve a lo guardado.
 */
export function RolesEditor({
  roles,
  modules,
  initial,
  initialRoleId,
}: {
  roles: EditorRole[];
  modules: EditorModule[];
  /** roleId → ids de permisos marcados (lo guardado). */
  initial: Record<string, string[]>;
  initialRoleId: string;
}) {
  const router = useRouter();
  const saved = useMemo(
    () => Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, new Set(v)])) as Record<string, Set<string>>,
    [initial],
  );
  const [draft, setDraft] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, new Set(v)])),
  );
  const [activeId, setActiveId] = useState(initialRoleId);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalPerms = modules.reduce((a, m) => a + m.perms.length, 0);
  const diffFor = (roleId: string) => {
    const a = saved[roleId] ?? new Set<string>();
    const b = draft[roleId] ?? new Set<string>();
    let n = 0;
    for (const id of a) if (!b.has(id)) n++;
    for (const id of b) if (!a.has(id)) n++;
    return n;
  };
  const changedRoles = roles.filter((r) => !r.isAdmin && diffFor(r.id) > 0);
  const totalChanges = changedRoles.reduce((a, r) => a + diffFor(r.id), 0);

  // Aviso del navegador si se sale con cambios sin guardar.
  useEffect(() => {
    if (totalChanges === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [totalChanges]);

  const active = roles.find((r) => r.id === activeId) ?? roles[0];
  const has = (roleId: string, permId: string) =>
    roles.find((r) => r.id === roleId)?.isAdmin ? true : (draft[roleId]?.has(permId) ?? false);

  function toggle(permId: string) {
    if (active.isAdmin) return;
    setDraft((d) => {
      const next = new Set(d[active.id] ?? []);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return { ...d, [active.id]: next };
    });
  }

  function toggleModule(m: EditorModule, on: boolean) {
    if (active.isAdmin) return;
    setDraft((d) => {
      const next = new Set(d[active.id] ?? []);
      for (const p of m.perms) {
        if (on) next.add(p.id);
        else next.delete(p.id);
      }
      return { ...d, [active.id]: next };
    });
  }

  function selectRole(id: string) {
    setActiveId(id);
    const name = roles.find((r) => r.id === id)?.name;
    if (name) window.history.replaceState(null, "", `/settings/roles?role=${name}`);
  }

  function discard() {
    setDraft(Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, new Set(v)])));
  }

  function save() {
    start(async () => {
      try {
        const res = await saveRolePermissionsAction(
          changedRoles.map((r) => ({ roleId: r.id, permissionIds: [...(draft[r.id] ?? [])] })),
        );
        if (res.error) setError(res.error);
        else {
          toast.success(`Permisos guardados (${res.changed} ${res.changed === 1 ? "cambio" : "cambios"}).`);
          router.refresh();
        }
      } catch {
        setError("No se pudieron guardar los permisos. Revisa tu conexión e intenta de nuevo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Roles" className="flex flex-wrap gap-2">
        {roles.map((r) => {
          const count = r.isAdmin ? totalPerms : (draft[r.id]?.size ?? 0);
          const selected = r.id === active.id;
          const dirty = !r.isAdmin && diffFor(r.id) > 0;
          return (
            <button
              type="button"
              key={r.id}
              onClick={() => selectRole(r.id)}
              title={r.hint}
              className={`flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm transition-colors ${
                selected
                  ? "border-brand-accent bg-brand-accent-light font-medium text-brand-accent"
                  : "border-brand-border bg-brand-surface text-brand-text hover:bg-brand-surface-hover"
              }`}
            >
              {r.isAdmin ? <Lock size={14} aria-hidden /> : <ShieldCheck size={14} aria-hidden />}
              {r.label}
              <span className="rounded-full bg-brand-background px-1.5 text-xs tabular-nums text-brand-muted">
                {count}/{totalPerms}
              </span>
              {dirty && <span className="h-2 w-2 rounded-full bg-brand-warning" title="Cambios sin guardar" />}
            </button>
          );
        })}
      </nav>

      <p className="-mt-1 text-sm text-brand-muted">
        <strong className="text-brand-text">{active.label}:</strong> {active.hint}
      </p>

      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((m) => {
          const on = m.perms.filter((p) => has(active.id, p.id)).length;
          const all = on === m.perms.length;
          return (
            <section key={m.key} className="rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-3">
              <h3 className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-brand-text">
                {m.label}
                <span className="flex items-center gap-2">
                  {!active.isAdmin && m.perms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => toggleModule(m, !all)}
                      className="text-xs font-normal text-brand-accent hover:underline"
                      title={all ? "Desmarcar todo este módulo" : "Marcar todo este módulo"}
                    >
                      {all ? "Quitar todo" : "Marcar todo"}
                    </button>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                      all
                        ? "bg-brand-success-bg text-brand-success"
                        : on === 0
                          ? "bg-brand-background text-brand-muted"
                          : "bg-brand-accent-light text-brand-accent"
                    }`}
                  >
                    {all ? "Todo" : on === 0 ? "Nada" : `${on} de ${m.perms.length}`}
                  </span>
                </span>
              </h3>
              <ul className="flex flex-col gap-0.5">
                {m.perms.map((perm) => {
                  const checked = has(active.id, perm.id);
                  const changed = !active.isAdmin && checked !== (saved[active.id]?.has(perm.id) ?? false);
                  return (
                    <li key={perm.id}>
                      <label
                        title={perm.code}
                        className={`flex items-start gap-2 rounded-[var(--radius-md)] px-1.5 py-0.5 text-sm ${
                          active.isAdmin ? "cursor-not-allowed" : "cursor-pointer hover:bg-brand-surface-hover"
                        } ${changed ? "bg-brand-warning-bg" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={active.isAdmin || pending}
                          onChange={() => toggle(perm.id)}
                          className="mt-0.5 h-4 w-4 accent-brand-accent disabled:opacity-40"
                        />
                        <span className="text-brand-text">{perm.description}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Barra fija abajo con Guardar / Descartar mientras haya cambios. */}
      <div
        className={`sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border px-4 py-3 shadow-[var(--shadow-lg)] ${
          totalChanges > 0 ? "border-brand-warning bg-brand-surface" : "border-brand-border bg-brand-surface"
        }`}
      >
        <p className="text-sm text-brand-text">
          {totalChanges > 0 ? (
            <>
              <strong>
                {totalChanges} {totalChanges === 1 ? "cambio sin guardar" : "cambios sin guardar"}
              </strong>{" "}
              en {changedRoles.map((r) => r.label).join(", ")}. Lo marcado en amarillo cambió.
            </>
          ) : (
            <span className="text-brand-muted">Sin cambios pendientes. Marca o desmarca y luego pulsa Guardar cambios.</span>
          )}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            icon={<Undo2 size={15} />}
            onClick={discard}
            disabled={totalChanges === 0 || pending}
            hint="Vuelve a como estaba guardado"
          >
            Descartar
          </Button>
          <Button
            type="button"
            icon={<Save size={15} />}
            onClick={save}
            loading={pending}
            disabled={totalChanges === 0}
            hint="Guarda los permisos de todos los roles que cambiaste"
          >
            Guardar cambios
          </Button>
        </div>
      </div>

      <ResultDialog open={!!error} tone="danger" title="No se guardaron los permisos" onClose={() => setError(null)}>
        <p className="text-sm text-brand-muted">{error}</p>
      </ResultDialog>
    </div>
  );
}
