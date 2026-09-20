"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Mail, KeyRound, CheckCircle2 } from "lucide-react";
import {
  requestPasswordReset,
  type AuthActionState,
} from "@/features/auth/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";

const initialState: AuthActionState = { error: null };

export default function RecoverPasswordPage() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  return (
    <AuthShell
      footerNote="Sistema interno de Mindfreak Events"
      brandContent={
        <>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(21,94,239,0.35)] bg-[rgba(21,94,239,0.14)] px-3 py-1.5">
            <KeyRound size={14} className="text-[#5b9bff]" />
            <span className="text-xs font-bold tracking-wide text-[#5b9bff]">RECUPERAR ACCESO</span>
          </span>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">
            Te ayudamos a volver a entrar.
          </h1>
          <p className="text-[14.5px] leading-relaxed text-white/60">
            Escribe el correo de tu cuenta y te enviaremos un enlace seguro para restablecer tu contraseña.
          </p>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-[26px] font-bold tracking-tight text-brand-primary">Recuperar contraseña</h2>
        <p className="text-[14.5px] text-brand-muted">
          Te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-[18px]">
        <Input
          id="email"
          label="Correo"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@mindfreakevents.com"
          icon={<Mail size={17} />}
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
          Enviar enlace
        </Button>
      </form>

      {state.submitted && (
        <div className="flex items-center gap-2.5 rounded-lg bg-brand-success-bg px-3 py-2.5">
          <CheckCircle2 size={15} className="shrink-0 text-brand-success" />
          <p className="text-[13px] font-medium text-brand-success">
            Si el correo existe, en unos minutos recibirás un enlace para continuar.
          </p>
        </div>
      )}

      <Link
        href="/login"
        className="text-center text-[13.5px] font-semibold text-brand-accent hover:underline"
      >
        Volver a ingresar
      </Link>
    </AuthShell>
  );
}
