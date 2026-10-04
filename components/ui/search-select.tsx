"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { FIELD_CLASSES, FieldWrapper } from "./field";

export type SearchOption = {
  value: string;
  label: string;
  /** Texto chico debajo (ej. la categoría de un tipo de servicio). */
  detail?: string;
  /** Grupo (encabezado) en la lista. */
  group?: string;
  /** Palabras extra por las que también se encuentra (ej. sus tipos de servicio). */
  keywords?: string[];
};

/** Minúsculas y sin acentos: "Fotografía" = "fotografia". */
export function searchKey(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Lista con buscador: igual que un <Select>, pero al abrirla se escribe para
 * filtrar (sin importar acentos ni mayúsculas). Para listas largas como
 * categorías, tipos de servicio o proveedores.
 *
 * Envía el valor en un <input type="hidden" name={name}> y avisa al
 * formulario con un evento "change" (así lo escuchan otras partes, como la
 * tarjeta de tratamiento fiscal). Se puede usar controlada (value +
 * onChange) o libre (defaultValue); en modo libre vuelve al valor inicial si
 * el formulario se reinicia.
 */
export function SearchSelect({
  label,
  name,
  options,
  value: controlled,
  defaultValue = "",
  onChange,
  emptyLabel = "Sin especificar",
  placeholder = "Escribe para buscar…",
  hint,
  info,
  required,
  disabled,
  noResultsText = "No hay resultados.",
}: {
  label?: string;
  name: string;
  options: SearchOption[];
  value?: string;
  defaultValue?: string;
  /** query = lo que se había escrito al elegir (para saber por qué palabra se encontró). */
  onChange?: (value: string, query: string) => void;
  /** Texto de la opción vacía; null = sin opción vacía. */
  emptyLabel?: string | null;
  placeholder?: string;
  hint?: string;
  info?: string;
  required?: boolean;
  disabled?: boolean;
  noResultsText?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [inner, setInner] = useState(defaultValue);
  const value = controlled ?? inner;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const lastSent = useRef(value);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = searchKey(query);
    const base = emptyLabel !== null ? [{ value: "", label: emptyLabel } as SearchOption] : [];
    if (!q) return [...base, ...options];
    const words = q.split(/\s+/);
    return options.filter((o) => {
      const hay = searchKey([o.label, o.detail ?? "", o.group ?? "", ...(o.keywords ?? [])].join(" "));
      return words.every((w) => hay.includes(w));
    });
  }, [options, query, emptyLabel]);

  // Avisar al formulario cuando cambia el valor (después de pintarlo en el input oculto).
  useEffect(() => {
    if (lastSent.current === value) return;
    lastSent.current = value;
    hiddenRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [value]);

  // Modo libre: volver al valor inicial si el formulario se reinicia.
  useEffect(() => {
    if (controlled !== undefined) return;
    const form = wrapRef.current?.closest("form");
    if (!form) return;
    const onReset = () => setInner(defaultValue);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [controlled, defaultValue]);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(v: string) {
    if (controlled === undefined) setInner(v);
    onChange?.(v, query);
    setOpen(false);
    setQuery("");
  }

  function openList() {
    if (disabled) return;
    setOpen(true);
    setActive(0);
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  return (
    <FieldWrapper label={label} htmlFor={id} hint={hint} info={info} required={required}>
      <div ref={wrapRef} className="relative">
        <input ref={hiddenRef} type="hidden" name={name} value={value} />
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openList();
            } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
              // Empezar a escribir sobre el campo abre la búsqueda con esa letra.
              e.preventDefault();
              openList();
              setQuery(e.key);
            }
          }}
          className={`${FIELD_CLASSES} flex items-center justify-between gap-2 text-left`}
        >
          <span className={`truncate ${selected ? "" : "text-brand-muted"}`}>
            {selected ? selected.label : (emptyLabel ?? "Selecciona…")}
          </span>
          <ChevronDown size={16} className="shrink-0 text-brand-muted" aria-hidden />
        </button>
        {/* Validación nativa del "requerido" (el input oculto no la tiene). */}
        {required && (
          <input
            tabIndex={-1}
            aria-hidden
            required
            value={value}
            onChange={() => {}}
            onFocus={() => openList()}
            className="pointer-events-none absolute inset-x-0 bottom-0 h-0 opacity-0"
          />
        )}

        {open && (
          <div className="absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-[var(--radius-md)] border border-brand-border bg-brand-surface shadow-[var(--shadow-lg)]">
            <div className="flex items-center gap-2 border-b border-brand-border px-3 py-2">
              <Search size={14} className="shrink-0 text-brand-muted" aria-hidden />
              <input
                ref={searchRef}
                role="combobox"
                aria-controls={listId}
                aria-expanded
                aria-autocomplete="list"
                aria-label={`Buscar ${label ?? ""}`.trim()}
                value={query}
                placeholder={placeholder}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, filtered.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const opt = filtered[active];
                    if (opt) choose(opt.value);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setOpen(false);
                  }
                }}
                className="w-full bg-transparent text-sm text-brand-text outline-none placeholder:text-brand-muted"
              />
              {query && (
                <button type="button" aria-label="Borrar búsqueda" onClick={() => setQuery("")} className="text-brand-muted hover:text-brand-text">
                  <X size={14} />
                </button>
              )}
            </div>
            <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 && <li className="px-3 py-2 text-sm text-brand-muted">{noResultsText}</li>}
              {filtered.map((o, i) => {
                // Encabezado de grupo: solo cuando cambia respecto a la opción anterior.
                const header = o.group && o.group !== filtered[i - 1]?.group && !query ? o.group : null;
                const isSel = o.value === value;
                const kwMatch =
                  query && o.keywords?.length
                    ? o.keywords.filter((k) => searchKey(k).includes(searchKey(query))).slice(0, 3)
                    : [];
                return (
                  <li key={o.value || "__empty"}>
                    {header && (
                      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{header}</p>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSel}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(o.value)}
                      className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm ${
                        i === active ? "bg-brand-surface-hover" : ""
                      } ${o.value === "" ? "text-brand-muted" : "text-brand-text"}`}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{o.label}</span>
                        {(o.detail || (query && o.group)) && (
                          <span className="truncate text-xs text-brand-muted">{o.detail ?? o.group}</span>
                        )}
                        {kwMatch.length > 0 && (
                          <span className="truncate text-xs text-brand-accent">Incluye: {kwMatch.join(", ")}</span>
                        )}
                      </span>
                      {isSel && <Check size={14} className="mt-0.5 shrink-0 text-brand-accent" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </FieldWrapper>
  );
}
