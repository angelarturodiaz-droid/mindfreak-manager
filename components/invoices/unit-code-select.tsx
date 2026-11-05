import { Select } from "@/components/ui/field";
import { DEFAULT_UNIT_CODE, ECF_FIELD_INFO, UNITS_COMMON, UNITS_OTHER } from "@/lib/dgii/catalogs";

/** 5b — Unidad de medida oficial (Tabla IV del e-CF) del producto o servicio. */
export function UnitCodeSelect({ defaultValue, className }: { defaultValue?: string | null; className?: string }) {
  return (
    <Select
      label="Unidad"
      name="unit_code"
      defaultValue={defaultValue ?? DEFAULT_UNIT_CODE}
      info={`Cómo se cobra este producto o servicio. ${ECF_FIELD_INFO.unit} Se pone sola en cada línea de cotización y factura (y en la factura electrónica con su código oficial de la DGII).`}
      className={className}
    >
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
  );
}
