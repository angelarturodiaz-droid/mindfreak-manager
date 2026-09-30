"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Input } from "./field";

/**
 * Buscador que filtra mientras escribes: a los 300 ms de dejar de teclear
 * actualiza `?q=` en la URL (y vuelve a la página 1), sin tener que pulsar
 * Enter. Conserva los demás filtros de la URL. Si se borra el texto, se
 * quita la búsqueda.
 */
export function LiveSearchInput({
  name = "q",
  defaultValue = "",
  placeholder,
  ariaLabel,
  className = "w-64",
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // "Limpiar" (u otro enlace) quitó la búsqueda de la URL: vaciar el cuadro,
  // salvo que el usuario esté escribiendo en él.
  useEffect(() => {
    if (document.activeElement === inputRef.current || timer.current) return;
    setValue(defaultValue);
  }, [defaultValue]);

  function apply(next: string) {
    const qs = new URLSearchParams(searchParams.toString());
    const text = next.trim();
    if (text) qs.set(name, text);
    else qs.delete(name);
    qs.delete("page");
    const query = qs.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="search"
        name={name}
        icon={<Search size={15} />}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            timer.current = null;
            apply(next);
          }, 300);
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        className={className}
      />
      {pending && (
        <Loader2
          size={14}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-brand-muted"
          aria-hidden
        />
      )}
    </div>
  );
}
