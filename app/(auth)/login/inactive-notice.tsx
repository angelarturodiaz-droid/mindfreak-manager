"use client";

import { useSearchParams } from "next/navigation";
import { CircleAlert, Clock } from "lucide-react";

/** Avisos al volver al login: cuenta desactivada, o sesión cerrada por inactividad. */
export function InactiveNotice() {
  const params = useSearchParams();
  if (params.get("motivo") === "inactividad") {
    return (
      <div role="status" className="flex items-start gap-2 rounded-lg bg-brand-warning-bg px-3 py-2.5">
        <Clock size={15} className="mt-0.5 shrink-0 text-brand-warning" />
        <p className="text-[13px] font-medium text-brand-text">
          Se cerró tu sesión por inactividad, para proteger la información. Vuelve a entrar para continuar.
        </p>
      </div>
    );
  }
  if (params.get("cuenta") !== "desactivada") return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg bg-brand-danger-bg px-3 py-2.5">
      <CircleAlert size={15} className="mt-0.5 shrink-0 text-brand-danger" />
      <p className="text-[13px] font-medium text-brand-danger">
        Tu cuenta está desactivada y se cerró la sesión. Habla con el administrador del sistema para volver a activarla.
      </p>
    </div>
  );
}
