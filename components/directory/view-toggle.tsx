"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";

const KEY = "mf.directory.view";

/** «Tarjetas / Lista»: la vista elegida se recuerda en esta computadora. */
export function DirectoryViewToggle({ current }: { current: "tarjetas" | "lista" }) {
  const router = useRouter();
  const params = useSearchParams();

  // Sin «vista» en la dirección: usa la que se eligió la última vez.
  useEffect(() => {
    if (params.get("vista")) return;
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(KEY);
    } catch {
      /* sin almacenamiento */
    }
    if (saved === "lista") {
      const p = new URLSearchParams(params.toString());
      p.set("vista", "lista");
      router.replace(`/directory?${p}`);
    }
  }, [params, router]);

  function hrefFor(v: "tarjetas" | "lista") {
    const p = new URLSearchParams(params.toString());
    p.set("vista", v);
    p.delete("page");
    return `/directory?${p}`;
  }
  function remember(v: string) {
    try {
      window.localStorage.setItem(KEY, v);
    } catch {
      /* sin almacenamiento */
    }
  }

  const base = "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors";
  return (
    <div role="group" aria-label="Cómo ver el directorio" className="inline-flex overflow-hidden rounded-[var(--radius-md)] border border-brand-border">
      <Link
        href={hrefFor("tarjetas")}
        onClick={() => remember("tarjetas")}
        title="Tarjetas con foto (24 por página)"
        className={`${base} ${current === "tarjetas" ? "bg-brand-accent-light font-medium text-brand-accent" : "text-brand-muted hover:bg-brand-surface-hover"}`}
      >
        <LayoutGrid size={14} aria-hidden /> Tarjetas
      </Link>
      <Link
        href={hrefFor("lista")}
        onClick={() => remember("lista")}
        title="Lista compacta para comparar (10 por página)"
        className={`${base} border-l border-brand-border ${current === "lista" ? "bg-brand-accent-light font-medium text-brand-accent" : "text-brand-muted hover:bg-brand-surface-hover"}`}
      >
        <List size={14} aria-hidden /> Lista
      </Link>
    </div>
  );
}
