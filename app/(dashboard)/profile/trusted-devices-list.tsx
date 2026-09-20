"use client";

import { useState, useTransition } from "react";
import { revokeTrustedDeviceAction, revokeAllTrustedDevicesAction } from "@/features/profile/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";

export type TrustedDeviceRow = {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-DO", { year: "numeric", month: "short", day: "numeric" });
}

export function TrustedDevicesList({ initialDevices }: { initialDevices: TrustedDeviceRow[] }) {
  const [devices, setDevices] = useState(initialDevices);
  const [isPending, startTransition] = useTransition();

  function handleRevoke(id: string) {
    startTransition(async () => {
      try {
        await revokeTrustedDeviceAction(id);
        setDevices((prev) => prev.filter((d) => d.id !== id));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo revocar.");
      }
    });
  }

  function handleRevokeAll() {
    if (!window.confirm("Esto va a pedir el código de nuevo en todos tus equipos guardados. ¿Continuar?")) return;
    startTransition(async () => {
      try {
        await revokeAllTrustedDevicesAction();
        setDevices([]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo revocar.");
      }
    });
  }

  if (devices.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        No tienes equipos guardados. Marca &ldquo;recordar este equipo&rdquo; al verificar el código para no tener
        que escribirlo cada vez que entres desde ahí (por 90 días).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {devices.map((device) => (
          <div
            key={device.id}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-brand-border px-3 py-2 text-sm"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-brand-text">{device.label ?? "Equipo sin nombre"}</span>
                {device.isCurrent && <Badge tone="success">Este equipo</Badge>}
              </div>
              <p className="text-xs text-brand-muted">
                Último uso: {formatDate(device.lastUsedAt)} · Vence: {formatDate(device.expiresAt)}
              </p>
            </div>
            <Button size="sm" variant="ghost" disabled={isPending} onClick={() => handleRevoke(device.id)}>
              Revocar
            </Button>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" disabled={isPending} onClick={handleRevokeAll} className="self-start">
        Revocar todos
      </Button>
    </div>
  );
}
