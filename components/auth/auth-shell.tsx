"use client";

import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Envoltorio compartido por las 3 pantallas de autenticación (login,
 * recuperar contraseña, verificación en dos pasos) — panel de marca oscuro
 * a la izquierda (logo + mensaje contextual) y el formulario a la derecha.
 * En mobile/tablet el panel se colapsa a una franja compacta con el logo.
 *
 * Cada página define su propio contenido de marca (`brandContent`) y de
 * pie de página (`footerNote`), pero comparten el fondo, la textura y el
 * logo para que las 3 pantallas se sientan parte de un mismo sistema.
 */
export function AuthShell({
  brandContent,
  footerNote = "Sistema interno de Mindfreak Events",
  alert = false,
  children,
}: {
  brandContent: ReactNode;
  footerNote?: ReactNode;
  alert?: boolean;
  children: ReactNode;
}) {
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
          <Image
            src="/brand/mindfreak-logo-on-dark.png"
            alt="Mindfreak Events"
            width={175}
            height={86}
            className="h-11 w-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
            priority
          />
        </div>

        <div className="relative flex max-w-sm flex-col gap-7">{brandContent}</div>

        <div className="relative border-t border-white/10 pt-6 text-xs font-medium text-white/50">{footerNote}</div>
      </div>

      {/* Panel de formulario */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        {/* Marca compacta — solo en mobile/tablet */}
        <div className="mb-8 flex items-center lg:hidden">
          <div className="inline-flex items-center rounded-xl bg-brand-secondary px-5 py-3">
            <Image
              src="/brand/mindfreak-logo-on-dark.png"
              alt="Mindfreak Events"
              width={175}
              height={86}
              className="h-8 w-auto"
              priority
            />
          </div>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-8">{children}</div>
      </div>
    </main>
  );
}
