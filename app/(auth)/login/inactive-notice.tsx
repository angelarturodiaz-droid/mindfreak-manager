"use client";

import { useSearchParams } from "next/navigation";
import { CircleAlert } from "lucide-react";

/** Aviso cuando la sesión se cerró porque un administrador desactivó la cuenta. */
export function InactiveNotice() {
  const params = useSearchParams();
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
