"use client";

import { useState, useTransition } from "react";
import { generateRecoveryCodesAction } from "@/features/profile/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export type RecoveryCodesStatus = {
  total: number;
  remaining: number;
  generatedAt: string | null;
};

export function RecoveryCodesSetup({
  initialStatus,
  hasFactor,
}: {
  initialStatus: RecoveryCodesStatus;
  hasFactor: boolean;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    if (status.total > 0 && !window.confirm("Esto invalida los códigos anteriores. ¿Generar códigos nuevos?")) {
      return;
    }
    startTransition(async () => {
      try {
        const result = await generateRecoveryCodesAction();
        setCodes(result);
        setConfirmed(false);
        setStatus({ total: result.length, remaining: result.length, generatedAt: new Date().toISOString() });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudieron generar los códigos.");
      }
    });
  }

  async function handleCopyAll() {
    if (!codes) return;
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast.success("Códigos copiados");
    } catch {
      toast.error("No se pudo copiar. Selecciónalos manualmente.");
    }
  }

  if (codes) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-brand-muted">
          Guarda estos {codes.length} códigos en un lugar seguro (un gestor de contraseñas, por ejemplo). Cada uno
          sirve para entrar <strong>una sola vez</strong> si pierdes el acceso a tu autenticador. No se van a volver
          a mostrar.
        </p>
        <div className="grid grid-cols-2 gap-2 rounded-[var(--radius-md)] border border-brand-border bg-brand-background p-4 font-mono text-sm">
          {codes.map((code) => (
            <span key={code}>{code}</span>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCopyAll}>
            Copiar todos
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm text-brand-text">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          Ya los guardé en un lugar seguro
        </label>
        <Button size="sm" disabled={!confirmed} onClick={() => setCodes(null)}>
          Listo
        </Button>
      </div>
    );
  }

  if (!hasFactor) {
    return <p className="text-sm text-brand-muted">Activa el autenticador arriba para poder generar códigos.</p>;
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-brand-muted">
        {status.total === 0
          ? "No has generado códigos de recuperación todavía."
          : `${status.remaining} de ${status.total} códigos sin usar.`}
      </p>
      <Button size="sm" variant="outline" loading={isPending} onClick={handleGenerate}>
        {status.total === 0 ? "Generar códigos" : "Generar códigos nuevos"}
      </Button>
    </div>
  );
}
