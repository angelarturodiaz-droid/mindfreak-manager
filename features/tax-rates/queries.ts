import { createClient } from "@/lib/supabase/server";

export async function listTaxRates(onlyActive = true) {
  const supabase = await createClient();
  let query = supabase
    .from("tax_rates")
    .select("id, name, rate, is_default, is_active")
    .order("is_default", { ascending: false })
    .order("name");
  if (onlyActive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

/** Tasa de impuesto marcada como predeterminada en Configuración → Impuestos, para usarla como default al agregar una línea nueva (en vez de un 18% fijo en el código). Si no hay ninguna configurada, cae en 18. */
export async function getDefaultTaxRate(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tax_rates")
    .select("rate")
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.rate ? Number(data.rate) : 18;
}
