import { normalizeCatalogName } from "@/features/supplier-service-types/classification";

/** Categoría de gastos de los incentivos (la crea la migración 088). */
export const INCENTIVE_CATEGORY_NAME = "Incentivo por proyecto";

/** Llave de catálogo (sin mayúsculas, tildes ni espacios de más), igual que public.catalog_key. */
export function catalogKeyOf(name: string): string {
  return normalizeCatalogName(name);
}

export const RECIPIENT_TYPE_LABELS: Record<string, string> = {
  EMPLOYEE: "Empleado",
  THIRD_PARTY: "Tercero",
};
