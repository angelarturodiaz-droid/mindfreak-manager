"use client";

import { Select, type SelectProps } from "./field";

/**
 * Select que envía su formulario al cambiar de opción (filtros de listas),
 * para no obligar a presionar un botón "Filtrar" aparte.
 */
export function AutoSubmitSelect(props: SelectProps) {
  return (
    <Select
      {...props}
      onChange={(e) => {
        props.onChange?.(e);
        e.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
