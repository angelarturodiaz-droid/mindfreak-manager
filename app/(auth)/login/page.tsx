"use client";

import { useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Mail, Lock, ShieldCheck, CircleAlert, CheckCircle2 } from "lucide-react";
import { signIn, type AuthActionState } from "@/features/auth/actions";
import { Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { TurnstileWidget } from "@/components/ui/turnstile-widget";
import { Button } from "@/components/ui/button";

const initialState: AuthActionState = { error: null };

const FEATURES = [
  "Cotizaciones y facturas con NCF electrónico",
  "Pagos, cuentas bancarias y conciliación",
  "Reportes en tiempo real para todo el equipo",
];

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const alert = state.requiresCaptcha === true;

  return (
    <main className="flex min-h-full flex-1 bg-brand-background">
      {/* Panel de marca — solo en pantallas grandes */}
      <div
        className={`relative hidden w-[480px] shrink-0 flex-col justify-between overflow-hidden px-12 py-12 lg:flex ${
          alert
            ? "bg-[radial-gradient(120%_100%_at_100%_0%,#241318_0%,#150b0e_55%,#0a0607_100%)]"
            : "bg-[radial-gradient(120%_100%_at_100%_0%,#16213a_0%,#0b1220_55%,#070b14_100%)]"
        }`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          className="pointer-events-none absolute -top-40 -right-36 h-[420px] w-[420px] rounded-full"
          style={{
            background: alert
              ? "radial-gradient(circle, rgba(240,68,56,0.28) 0%, rgba(240,68,56,0) 70%)"
              : "radial-gradient(circle, rgba(21,94,239,0.35) 0%, rgba(21,94,239,0) 70%)",
          }}
        />

        <div className="relative flex items-center">
          <div className="inline-flex items-center rounded-xl bg-white px-4 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.25)]">
            <Image src="/brand/mindfreak-logo.png" alt="Mindfreak Events" width={140} height={69} className="h-9 w-auto" priority />
          </div>
        </div>

        {alert ? (
          <div className="relative flex max-w-sm flex-col gap-5">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(240,68,56,0.3)] bg-[rgba(240,68,56,0.14)] px-3 py-1.5">
              <CircleAlert size={14} className="text-[#f97066]" />
              <span className="text-xs font-bold tracking-wide text-[#f97066]">ALERTA DE SEGURIDAD</span>
            </span>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">
              Detectamos varios intentos fallidos seguidos.
            </h1>
            <p className="text-[14.5px] leading-relaxed text-white/60">
              Para proteger la cuenta, confirma que no eres un robot antes de intentar de nuevo con la contraseña
              correcta.
            </p>
          </div>
        ) : (
          <div className="relative flex max-w-sm flex-col gap-7">
            <h1 className="text-[34px] font-bold leading-tight tracking-tight text-white">
              Toda tu operación, desde la cotización hasta el cobro.
            </h1>
            <p className="text-[15px] leading-relaxed text-white/60">
              Un solo lugar para clientes, proyectos, facturación electrónica, pagos y reportes de Mindfreak Events.
            </p>
            <div className="mt-2 flex flex-col gap-4">
              {FEATURES.map((f) => (
                <div key={f} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#3dd68c]" />
                  <span className="text-sm font-medium text-white/80">{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="relative border-t border-white/10 pt-6 text-xs font-medium text-white/50">
          {alert ? "¿No fuiste tú? Contacta a un administrador del sistema." : "Sistema interno de Mindfreak Events"}
        </div>
      </div>

      {/* Panel de formulario */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        {/* Marca compacta — solo en mobile/tablet */}
        <div className="mb-8 flex items-center lg:hidden">
          <div className="inline-flex items-center rounded-xl bg-brand-secondary px-4 py-2.5">
            <Image src="/brand/mindfreak-logo.png" alt="Mindfreak Events" width={140} height={69} className="h-7 w-auto" priority />
          </div>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-[26px] font-bold tracking-tight text-brand-primary">Bienvenido de nuevo</h2>
            <p className="text-[14.5px] text-brand-muted">Ingresa con tu cuenta para continuar.</p>
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
            <PasswordInput
              id="password"
              label="Contraseña"
              name="password"
              required
              autoComplete="current-password"
              icon={<Lock size={16} />}
            />

            <div className="flex items-center justify-end">
              <Link href="/recover-password" className="text-[13.5px] font-semibold text-brand-accent hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {state.requiresCaptcha && (
              <div>
                <p className="mb-2 text-xs text-brand-muted">
                  Detectamos varios intentos fallidos seguidos — confirma que no eres un robot para continuar.
                </p>
                <TurnstileWidget />
              </div>
            )}

            {state.error && (
              <div className="flex items-center gap-2 rounded-lg bg-brand-danger-bg px-3 py-2.5">
                <CircleAlert size={15} className="shrink-0 text-brand-danger" />
                <p className="text-[13px] font-medium text-brand-danger">{state.error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant={alert ? "primary" : "secondary"}
              loading={pending}
              className="w-full justify-center !py-3 text-[15px] font-bold"
            >
              Ingresar
            </Button>
          </form>

          <div className="flex items-center gap-2.5 border-t border-brand-border pt-5">
            <ShieldCheck size={15} className="shrink-0 text-brand-success" />
            <span className="text-xs font-medium text-brand-muted">
              Protegido con verificación en dos pasos y detección de accesos sospechosos.
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
