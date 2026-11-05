"use client";

import { Select } from "@/components/ui/field";
import { DEFAULT_UNIT_CODE, ECF_FIELD_INFO, ITEM_KINDS, UNITS_COMMON, UNITS_OTHER, unitName } from "@/lib/dgii/catalogs";

/**
 * 5b — Solo en factura electrónica: unidad de medida (Tabla IV) y si es bien o servicio.
 * Al elegir un producto o servicio del catálogo se llenan solos con lo que dice su ficha (se pueden cambiar).
 */
export function EcfLineFields({
  unit,
  kind,
  onUnit,
  onKind,
  fromCatalog,
}: {
  unit: string;
  kind: string;
  onUnit: (v: string) => void;
  onKind: (v: string) => void;
  /** Nombre del producto o servicio elegido (para explicar de dónde salió el valor). */
  fromCatalog: string | null;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] bg-brand-surface-hover p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="Unidad de medida (e-CF)" name="unit_code" value={unit} onChange={(e) => onUnit(e.currentTarget.value)} info={ECF_FIELD_INFO.unit} required>
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
        <Select label="Bien o servicio" name="item_kind" value={kind} onChange={(e) => onKind(e.currentTarget.value)} info={ECF_FIELD_INFO.itemKind} required>
          {ITEM_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-xs text-brand-muted">
        {fromCatalog
          ? `Tomado de la ficha de «${fromCatalog}» (${unitName(unit || DEFAULT_UNIT_CODE)} · ${kind === "BIEN" ? "Bien" : "Servicio"}). Si lo cambias aquí, solo cambia en esta línea; para que salga siempre así, cámbialo en Productos y Servicios.`
          : "Línea libre: revisa la unidad (ej. Hora si el precio es por hora) y si es bien o servicio."}
      </p>
    </div>
  );
}
