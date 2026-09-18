"use client";

import { useState, useTransition } from "react";
import {
  enrollMfaAction,
  verifyMfaEnrollmentAction,
  cancelMfaEnrollmentAction,
  unenrollMfaAction,
} from "@/features/profile/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

type Factor = { id: string; status: string };

export function AuthenticatorSetup({ initialFactor }: { initialFactor: Factor | null }) {
  const [factor, setFactor] = useState<Factor | null>(initialFactor);
  const [enrolling, setEnrolling] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleActivate() {
    startTransition(async () => {
      try {
        const result = await enrollMfaAction();
        setEnrolling(result);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo iniciar la activación.");
      }
    });
  }

  function handleConfirm() {
    if (!enrolling) return;
    startTransition(async () => {
      try {
        await verifyMfaEnrollmentAction(enrolling.factorId, code);
        setFactor({ id: enrolling.factorId, status: "verified" });
        setEnrolling(null);
        setCode("");
        toast.success("Autenticador activado");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Código incorrecto.");
      }
    });
  }

  function handleCancel() {
    if (!enrolling) return;
    startTransition(async () => {
      await cancelMfaEnrollmentAction(enrolling.factorId);
      setEnrolling(null);
      setCode("");
    });
  }

  function handleRemove() {
    if (!factor) return;
    startTransition(async () => {
      try {
        await unenrollMfaAction(factor.id);
        setFactor(null);
        toast.success("Autenticador desactivado");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo desactivar.");
      }
    });
  }

  if (enrolling) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-brand-muted">
          Escanea este código con Google Authenticator (o cualquier app
          compatible) y escribe el código de 6 dígitos que te muestre.
        </p>
        <img
          src={enrolling.qrCode}
          alt="Código QR para el autenticador"
          className="h-40 w-40 self-center"
        />
        <p className="text-center text-xs text-brand-muted">
          ¿No puedes escanear? Escribe esta clave manualmente:{" "}
          <span className="font-mono font-medium text-brand-text">{enrolling.secret}</span>
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código de 6 dígitos"
          inputMode="numeric"
          maxLength={6}
          className="rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-3 py-1.5 text-center text-sm outline-none focus:border-brand-accent"
        />
        <div className="flex gap-2">
          <Button size="sm" loading={isPending} onClick={handleConfirm}>
            Confirmar
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isPending}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (factor) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-brand-success">Activo</span>
        <Button size="sm" variant="ghost" loading={isPending} onClick={handleRemove}>
          Quitar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-brand-muted">App autenticadora (TOTP) — no activado</span>
      <Button size="sm" variant="outline" loading={isPending} onClick={handleActivate}>
        Activar
      </Button>
    </div>
  );
}
