"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { updateProjectStatusAction } from "@/features/projects/actions";

/**
 * Después del primer anticipo de un proyecto que sigue en Planificación:
 * «¿Pasamos el proyecto a Confirmado?». No cambia nada solo: el usuario decide.
 */
export function ConfirmProjectPrompt({
  projectId,
  projectNumber,
  to = "CONFIRMED",
}: {
  projectId: string;
  projectNumber: string;
  /** CONFIRMED (tras un anticipo) o IN_PROGRESS (tras emitir una factura). */
  to?: "CONFIRMED" | "IN_PROGRESS";
}) {
  const label = to === "CONFIRMED" ? "Confirmado" : "En curso";
  const [hidden, setHidden] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  if (hidden) return null;
  if (done) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-brand-success">
        <CheckCircle2 size={15} aria-hidden /> {projectNumber} ahora está {label}.
      </p>
    );
  }
  return (
    <div className="rounded-[var(--radius-md)] border border-brand-warning/30 bg-brand-warning-bg px-3 py-2.5 text-sm text-brand-text">
      <p>
        {to === "CONFIRMED" ? (
          <>
            <strong>El cliente pagó un anticipo:</strong> ¿pasamos el proyecto {projectNumber} a <strong>Confirmado</strong>?
            Normalmente el anticipo es la señal de que el cliente confirmó el evento.
          </>
        ) : (
          <>
            <strong>¿El evento ya empezó?</strong> ¿Pasamos el proyecto {projectNumber} a <strong>En curso</strong>? (Si tiene
            fecha, el día del evento pasa solo.)
          </>
        )}
      </p>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          loading={pending}
          hint={`Cambia el proyecto a ${label} (lo mismo que pulsar «${label}» en el Avance del proyecto).`}
          onClick={() =>
            startTransition(async () => {
              try {
                await updateProjectStatusAction(projectId, to);
                setDone(true);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
              }
            })
          }
        >
          {to === "CONFIRMED" ? "Sí, confirmar" : "Sí, está en curso"}
        </Button>
        <Button size="sm" variant="outline" hint="Deja el proyecto como está." onClick={() => setHidden(true)}>
          Ahora no
        </Button>
      </div>
    </div>
  );
}
