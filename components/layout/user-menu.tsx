"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { User, LogOut } from "lucide-react";
import { signOut } from "@/features/auth/actions";

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function UserMenu({
  fullName,
  email,
}: {
  fullName: string | null;
  email: string;
}) {
  const [open, setOpen] = useState(false);
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
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent text-xs font-semibold text-white transition-opacity hover:opacity-90"
      >
        {initials(fullName, email)}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-64 rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-4 text-center shadow-[var(--shadow-lg)]">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent text-base font-semibold text-white">
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

          <form action={signOut}>
            <button
              type="submit"
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-brand-background py-2 text-sm text-brand-text hover:bg-brand-surface-hover"
            >
              <LogOut size={14} /> Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
