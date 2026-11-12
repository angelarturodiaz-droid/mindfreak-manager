"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { ResultDialog } from "@/components/ui/result-dialog";
import { updateIdleTimeoutAction } from "@/features/settings/security-actions";
import { IDLE_OPTIONS } from "@/lib/session/idle";

/** Configuración → Seguridad → Cerrar sesión por inactividad. */
export function IdleTimeoutForm({ current }: { current: number }) {
  const [value, setValue] = useState(current);
  const [saved, setSaved] = useState(current);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    const res = await updateIdleTimeoutAction(value);
    setBusy(false);
    if (res.error) return setResult({ ok: false, text: res.error });
    setSaved(value);
    setResult({ ok: true, text: `Desde ahora la sesión se cierra tras ${value} minutos sin usar el sistema. Se aplica a cada usuario en su próxima página.` });
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
        <Clock size={16} className="text-brand-accent" aria-hidden /> Cerrar sesión por inactividad
        <InfoHint text="Si nadie usa el sistema en ese navegador (mouse, teclado o pantalla) durante este tiempo, sale un aviso de 60 segundos con «Seguir conectado» y luego se cierra la sesión. Trabajar en una pestaña mantiene abiertas las demás. Lo que no se haya guardado se pierde." />
      </p>
      <p className="text-sm text-brand-muted">
        Protege la información si alguien deja la computadora abierta. Para volver a entrar se pide la contraseña (y el código, si el
        equipo no es de confianza).
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-brand-text">Tiempo sin uso</span>
          <select
            value={value}
            onChange={(e) => setValue(Number(e.currentTarget.value))}
            className="h-9 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-3 text-sm text-brand-text"
          >
            {IDLE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} minutos{m === 30 ? " (recomendado)" : ""}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" onClick={save} loading={busy} disabled={value === saved}>
          Guardar
        </Button>
      </div>
      <ResultDialog
        open={result !== null}
        tone={result?.ok ? "success" : "danger"}
        title={result?.ok ? "Guardado" : "No se pudo guardar"}
        onClose={() => setResult(null)}
      >
        <p>{result?.text}</p>
      </ResultDialog>
    </Card>
  );
}
