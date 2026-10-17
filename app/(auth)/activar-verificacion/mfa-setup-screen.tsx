"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, Smartphone, QrCode, KeyRound, CircleAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { startMfaSetupAction, finishMfaSetupAction } from "@/features/profile/actions";
import { signOut } from "@/features/auth/actions";

const STEPS = [
  { icon: Smartphone, text: "Instala en tu teléfono Google Authenticator o Microsoft Authenticator (gratis)." },
  { icon: QrCode, text: "Pulsa «Mostrar código QR» y escanéalo con la app." },
  { icon: KeyRound, text: "Escribe el código de 6 dígitos que te muestra la app." },
];

export function MfaSetupScreen({ email }: { email: string }) {
  const [setup, setSetup] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function showQr() {
    setError(null);
    start(async () => {
      const res = await startMfaSetupAction();
      if (res.error || !res.data) setError(res.error ?? "No se pudo generar el código QR.");
      else setSetup(res.data);
    });
  }

  function confirm() {
    if (!setup) return;
    setError(null);
    start(async () => {
      const res = await finishMfaSetupAction(setup.factorId, code);
      if (res.error) {
        setError(res.error);
        setCode("");
      } else {
        setDone(true);
        // Recarga completa para que se habilite todo el sistema.
        window.location.assign("/dashboard");
      }
    });
  }

  return (
    <AuthShell
      footerNote="Sistema interno de Mindfreak Events"
      brandContent={
        <>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(61,214,140,0.35)] bg-[rgba(61,214,140,0.12)] px-3 py-1.5">
            <ShieldCheck size={14} className="text-[#3dd68c]" />
            <span className="text-xs font-bold tracking-wide text-[#3dd68c]">ÚLTIMO PASO</span>
          </span>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">Protege tu cuenta con tu teléfono.</h1>
          <p className="text-[14.5px] leading-relaxed text-white/60">
            Además de tu contraseña, el sistema te pedirá un código que cambia cada 30 segundos en tu teléfono. Así, aunque
            alguien sepa tu contraseña, no puede entrar. Es obligatorio para todos los usuarios.
          </p>
          <div className="mt-2 flex flex-col gap-4">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-white/80">{s.text}</span>
              </div>
            ))}
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-[26px] font-bold tracking-tight text-brand-primary">Activa la verificación en dos pasos</h2>
        <p className="text-[14.5px] text-brand-muted">
          Cuenta: <span className="font-medium text-brand-text">{email}</span>
        </p>
      </div>

      {!setup ? (
        <div className="flex flex-col gap-4">
          <ol className="flex flex-col gap-3 lg:hidden">
            {STEPS.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-brand-text">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-accent-light text-xs font-bold text-brand-accent">
                  {i + 1}
                </span>
                {s.text}
              </li>
            ))}
          </ol>
          <div className="flex items-start gap-3 rounded-lg border border-brand-border bg-brand-surface px-4 py-3 text-sm text-brand-muted">
            <Smartphone size={18} className="mt-0.5 shrink-0 text-brand-accent" />
            Ten tu teléfono a mano con la app instalada. Si ya usas el autenticador para otra cuenta, se agrega como una
            cuenta más.
          </div>
          <Button
            type="button"
            variant="secondary"
            loading={pending}
            onClick={showQr}
            className="w-full justify-center !py-3 text-[15px] font-bold"
            icon={<QrCode size={16} />}
          >
            Mostrar código QR
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-brand-muted">Escanea este código con la app de tu teléfono:</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR en data URL generado por Supabase */}
          <img
            src={setup.qrCode}
            alt="Código QR para el autenticador"
            className="h-44 w-44 self-center rounded-lg border border-brand-border bg-white p-2"
          />
          <p className="text-center text-xs text-brand-muted">
            ¿No puedes escanear? Escribe esta clave en la app:{" "}
            <span className="break-all font-mono font-medium text-brand-text">{setup.secret}</span>
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mfa-code" className="text-sm font-medium text-brand-text">
              Código de 6 dígitos
            </label>
            <input
              id="mfa-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && confirm()}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-3 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-brand-accent"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            loading={pending || done}
            disabled={code.length !== 6}
            onClick={confirm}
            className="w-full justify-center !py-3 text-[15px] font-bold"
          >
            {done ? "Entrando…" : "Activar y entrar"}
          </Button>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg bg-brand-danger-bg px-3 py-2.5">
          <CircleAlert size={15} className="shrink-0 text-brand-danger" />
          <p className="text-[13px] font-medium text-brand-danger">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2.5 border-t border-brand-border pt-5">
        <span className="flex items-center gap-2 text-xs font-medium text-brand-muted">
          <ShieldCheck size={15} className="shrink-0 text-brand-success" />
          Luego podrás marcar «recordar este equipo» por 90 días.
        </span>
        <form action={signOut}>
          <button type="submit" className="inline-flex items-center gap-1 text-xs font-medium text-brand-muted hover:text-brand-text">
            <LogOut size={13} /> Salir
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
