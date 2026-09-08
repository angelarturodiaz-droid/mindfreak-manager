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
