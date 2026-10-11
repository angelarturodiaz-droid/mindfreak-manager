"use client";

import { useEffect, useRef, useState } from "react";
import { ResultDialog } from "./result-dialog";

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Nombre del campo tal como lo ve el usuario (su etiqueta, sin el asterisco). */
function fieldLabel(el: Field) {
  const label = el.labels?.[0]?.textContent ?? el.getAttribute("aria-label") ?? el.getAttribute("placeholder") ?? el.name;
  return (label ?? "Campo").replace(/\*/g, "").replace(/\s+/g, " ").trim();
}

/** Qué le falta al campo, en español. */
function problem(el: Field) {
  const v = el.validity;
  if (v.valueMissing) return el instanceof HTMLSelectElement ? "elige una opción" : "falta completarlo";
  if (v.typeMismatch) return el.type === "email" ? "el correo no tiene un formato válido (ej. nombre@empresa.com)" : "el formato no es válido";
  if (v.rangeUnderflow) return `debe ser ${("min" in el && el.min) || "mayor"} o más`;
  if (v.rangeOverflow) return `debe ser ${("max" in el && el.max) || "menor"} o menos`;
  if (v.tooShort) return `muy corto (mínimo ${"minLength" in el ? el.minLength : ""} caracteres)`;
  if (v.tooLong) return "es demasiado largo";
  if (v.stepMismatch) return "tiene demasiados decimales";
  if (v.patternMismatch) return el.title || "el formato no es válido";
  if (v.badInput) return "no es un valor válido";
  return "revisa este dato";
}

function mark(el: Field, on: boolean) {
  if (on) {
    el.setAttribute("aria-invalid", "true");
    el.style.borderColor = "var(--brand-danger)";
    el.style.boxShadow = "0 0 0 1px var(--brand-danger)";
  } else {
    el.removeAttribute("aria-invalid");
    el.style.borderColor = "";
    el.style.boxShadow = "";
  }
}

/**
 * Reemplaza en toda la aplicación el globo del navegador en inglés
 * ("Please fill out this field") por: el campo marcado en rojo y una ventana
 * en español con la lista de lo que falta. Al escribir, el rojo se quita.
 * Se monta una sola vez en el layout raíz.
 */
export function FormValidationGuard() {
  const [items, setItems] = useState<{ label: string; problem: string }[]>([]);
  const pending = useRef<Field[]>([]);
  const first = useRef<Field | null>(null);

  useEffect(() => {
    function onInvalid(e: Event) {
      const el = e.target as Field;
      if (!el || !("validity" in el)) return;
      e.preventDefault(); // sin el globo en inglés
      mark(el, true);
      pending.current.push(el);
      // El navegador dispara un "invalid" por campo, uno tras otro: se juntan (setTimeout, no microtask,
      // porque las microtareas corren entre un evento y el siguiente).
      if (pending.current.length === 1) {
        setTimeout(() => {
          const fields = pending.current;
          pending.current = [];
          first.current = fields[0] ?? null;
          setItems(fields.map((f) => ({ label: fieldLabel(f), problem: problem(f) })));
        }, 0);
      }
    }
    function onEdit(e: Event) {
      const el = e.target as Field;
      if (el?.getAttribute?.("aria-invalid") === "true" && "validity" in el && el.validity.valid) mark(el, false);
    }
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onEdit, true);
    document.addEventListener("change", onEdit, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", onEdit, true);
      document.removeEventListener("change", onEdit, true);
    };
  }, []);

  function close() {
    setItems([]);
    const el = first.current;
    first.current = null;
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.focus({ preventScroll: true });
    }
  }

  return (
    <ResultDialog
      open={items.length > 0}
      tone="danger"
      title={items.length === 1 ? "Falta un dato" : "Faltan algunos datos"}
      onClose={close}
    >
      <ul className="flex flex-col gap-1 text-left text-brand-text">
        {items.map((it, i) => (
          <li key={i}>
            <strong>{it.label}</strong>: {it.problem}.
          </li>
        ))}
      </ul>
      <p>Lo marcamos en rojo. Al cerrar te llevamos al primero.</p>
    </ResultDialog>
  );
}
