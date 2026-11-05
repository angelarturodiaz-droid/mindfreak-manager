"use client";

import { Select } from "@/components/ui/field";
import { ECF_FIELD_INFO, ITEM_KINDS, UNITS_COMMON, UNITS_OTHER } from "@/lib/dgii/catalogs";

/** 5b — Solo en factura electrónica: unidad de medida (Tabla IV) y si es bien o servicio. */
export function EcfLineFields() {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-[var(--radius-md)] bg-brand-surface-hover p-3 sm:grid-cols-2">
      <Select label="Unidad de medida (e-CF)" name="unit_code" defaultValue="" info={ECF_FIELD_INFO.unit}>
        <option value="">Según el producto o servicio (normalmente Unidad)</option>
        <optgroup label="Las más usadas">
          {UNITS_COMMON.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Todas las demás">
          {UNITS_OTHER.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </optgroup>
      </Select>
      <Select label="Bien o servicio" name="item_kind" defaultValue="" info={ECF_FIELD_INFO.itemKind}>
        <option value="">Según el catálogo (eventos = Servicio)</option>
        {ITEM_KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
