"use client";

import { useActionState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { updatePasswordAction, type AuthActionState } from "@/features/auth/actions";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";

const initialState: AuthActionState = { error: null };

export default function UpdatePasswordPage() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);

  return (
    <AuthShell
      footerNote="Sistema interno de Mindfreak Events"
      brandContent={
        <>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(21,94,239,0.35)] bg-[rgba(21,94,239,0.14)] px-3 py-1.5">
            <KeyRound size={14} className="text-[#5b9bff]" />
            <span className="text-xs font-bold tracking-wide text-[#5b9bff]">NUEVA CONTRASEÑA</span>
          </span>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">
            Ya casi. Elige tu nueva contraseña.
          </h1>
          <p className="text-[14.5px] leading-relaxed text-white/60">
            Usa al menos 8 caracteres y evita reutilizar contraseñas de otras cuentas.
          </p>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-[26px] font-bold tracking-tight text-brand-primary">Elige tu nueva contraseña</h2>
        <p className="text-[14.5px] text-brand-muted">Mínimo 8 caracteres.</p>
      </div>

      <form action={formAction} className="flex flex-col gap-[18px]">
        <PasswordInput
          id="password"
          label="Contraseña nueva"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          icon={<KeyRound size={16} />}
        />
        <PasswordInput
          id="confirmPassword"
          label="Confirmar contraseña"
          name="confirmPassword"
          required
          minLength={8}
          autoComplete="new-password"
          icon={<KeyRound size={16} />}
        />

        {state.error && (
          <div className="flex items-center gap-2 rounded-lg bg-brand-danger-bg px-3 py-2.5">
            <p className="text-[13px] font-medium text-brand-danger">{state.error}</p>
          </div>
        )}

        <Button
          type="submit"
          variant="secondary"
          loading={pending}
          className="w-full justify-center !py-3 text-[15px] font-bold"
        >
          Guardar contraseña
        </Button>
      </form>

      <div className="flex items-center gap-2.5 border-t border-brand-border pt-5">
        <ShieldCheck size={15} className="shrink-0 text-brand-success" />
        <span className="text-xs font-medium text-brand-muted">
          Este enlace solo se puede usar una vez y vence a los pocos minutos.
        </span>
      </div>
    </AuthShell>
  );
}
