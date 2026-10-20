"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { User, LogOut, ShieldCheck, FileText, LifeBuoy } from "lucide-react";
import { signOut } from "@/features/auth/actions";
import { LegalDialog } from "@/components/legal/legal-dialog";
import type { LegalSlug } from "@/lib/legal/content";
import { APP_VERSION, SUPPORT_EMAIL } from "@/lib/app-info";

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function UserMenu({
  fullName,
  email,
  brandAccent,
}: {
  fullName: string | null;
  email: string;
  brandAccent: string;
}) {
  const [open, setOpen] = useState(false);
  const [legal, setLegal] = useState<LegalSlug | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Cuenta"
        style={{ backgroundColor: brandAccent }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-90"
      >
        {initials(fullName, email)}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-64 rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-4 text-center shadow-[var(--shadow-lg)]">
          <div
            style={{ backgroundColor: brandAccent }}
            className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold text-white"
          >
            {initials(fullName, email)}
          </div>
          <p className="text-sm font-medium text-brand-text">{fullName || "Sin nombre"}</p>
          <p className="text-xs text-brand-muted">{email}</p>

          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="mt-3 flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] py-2 text-sm text-brand-accent hover:bg-brand-surface-hover"
          >
            <User size={14} /> Mi perfil
          </Link>

          <div className="mt-1 flex flex-col border-t border-brand-border pt-1 text-sm">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setLegal("privacidad");
              }}
              className="flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] py-2 text-brand-text hover:bg-brand-surface-hover"
            >
              <ShieldCheck size={14} className="text-brand-muted" /> Política de Privacidad
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setLegal("terminos");
              }}
              className="flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] py-2 text-brand-text hover:bg-brand-surface-hover"
            >
              <FileText size={14} className="text-brand-muted" /> Términos de Uso
            </button>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Soporte%20Mindfreak%20Manager`}
              className="flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] py-2 text-brand-text hover:bg-brand-surface-hover"
            >
              <LifeBuoy size={14} className="text-brand-muted" /> Soporte
            </a>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-brand-background py-2 text-sm text-brand-text hover:bg-brand-surface-hover"
            >
              <LogOut size={14} /> Cerrar sesión
            </button>
          </form>
          <p className="mt-2 text-[11px] text-brand-muted">Versión {APP_VERSION}</p>
        </div>
      )}
      <LegalDialog slug={legal} onClose={() => setLegal(null)} />
    </div>
  );
}
