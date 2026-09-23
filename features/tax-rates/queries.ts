import { createClient } from "@/lib/supabase/server";

export type TaxTreatment = "GRAVADO" | "EXENTO" | "NO_SUJETO";

export async function listTaxRates(onlyActive = true) {
  const supabase = await createClient();
  let query = supabase
    .from("tax_rates")
    .select("id, name, rate, treatment, is_default, is_active")
    .order("is_default", { ascending: false })
    .order("name");
  if (onlyActive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Tasa de impuesto marcada como predeterminada en Configuración → Impuestos,
 * para precargarla al agregar una línea nueva cuando el servicio no tiene su
 * propio tratamiento fiscal configurado. Si no hay ninguna marcada como
 * predeterminada (o no hay ninguna activa), devuelve null y el formulario
 * cae en la primera tasa activa del catálogo.
 */
export async function getDefaultTaxRate() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tax_rates")
    .select("id, name, rate, treatment")
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
