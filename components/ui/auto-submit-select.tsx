"use client";

import { Select, type SelectProps } from "./field";

/**
 * Select que envía su formulario al cambiar de opción (filtros de listas),
 * para no obligar a presionar un botón "Filtrar" aparte.
 *
 * resetOthers: cuando la lista actual no tiene resultados, elegir otra
 * opción busca SOLO por esa (vacía los demás campos del formulario, incluidos
 * los filtros ocultos), para no quedar atrapado en una combinación vacía.
 */
export function AutoSubmitSelect({ resetOthers = false, ...props }: SelectProps & { resetOthers?: boolean }) {
  return (
    <Select
      {...props}
      onChange={(e) => {
        props.onChange?.(e);
        const select = e.currentTarget;
        const form = select.form;
        if (!form) return;
        if (resetOthers) {
          for (const el of Array.from(form.elements)) {
            if (el === select) continue;
            if (el instanceof HTMLSelectElement) el.value = "";
            else if (el instanceof HTMLInputElement && ["hidden", "search", "text"].includes(el.type)) {
              el.value = ""; // vacío = sin ese filtro
            }
          }
        }
        form.requestSubmit();
      }}
    />
  );
}
