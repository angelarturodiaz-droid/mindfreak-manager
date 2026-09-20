"use client";

import { useActionState } from "react";
import { ShieldCheck, KeyRound } from "lucide-react";
import { verifyMfaChallengeAction, type AuthActionState } from "@/features/auth/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";

const initialState: AuthActionState = { error: null };

export default function MfaChallengePage() {
  const [state, formAction, pending] = useActionState(verifyMfaChallengeAction, initialState);

  return (
    <AuthShell
      footerNote="Sistema interno de Mindfreak Events"
      brandContent={
        <>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(21,94,239,0.35)] bg-[rgba(21,94,239,0.14)] px-3 py-1.5">
            <ShieldCheck size={14} className="text-[#5b9bff]" />
            <span className="text-xs font-bold tracking-wide text-[#5b9bff]">VERIFICACIÓN EN DOS PASOS</span>
          </span>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">
            Un último paso para proteger tu cuenta.
          </h1>
          <p className="text-[14.5px] leading-relaxed text-white/60">
            Abre tu app autenticadora (Google Authenticator u otra) y escribe el código de 6 dígitos para confirmar
            que eres tú.
          </p>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-[26px] font-bold tracking-tight text-brand-primary">Verificación en dos pasos</h2>
        <p className="text-[14.5px] text-brand-muted">
          Escribe el código de 6 dígitos de tu app autenticadora.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-[18px]">
        <Input
          id="code"
          label="Código de 6 dígitos"
          name="code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoFocus
          autoComplete="one-time-code"
          required
          placeholder="000000"
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
          Verificar
        </Button>
      </form>

      <div className="flex items-center gap-2.5 border-t border-brand-border pt-5">
        <ShieldCheck size={15} className="shrink-0 text-brand-success" />
        <span className="text-xs font-medium text-brand-muted">
          Este código expira a los pocos segundos por tu seguridad.
        </span>
      </div>
    </AuthShell>
  );
}
