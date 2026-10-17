"use client";

import { Check, Circle } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/auth/password-policy";

/** Lista en vivo de lo que le falta a la contraseña (debajo del campo). */
export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2" aria-live="polite">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <li key={r.id} className={`flex items-center gap-1.5 ${ok ? "text-brand-success" : "text-brand-muted"}`}>
            {ok ? <Check size={13} aria-hidden /> : <Circle size={11} aria-hidden />}
            {r.label}
          </li>
        );
      })}
      <li className="text-brand-muted sm:col-span-2">Que no sea común (123456, password…) ni contenga tu nombre o correo.</li>
    </ul>
  );
}
