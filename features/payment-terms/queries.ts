import { createClient } from "@/lib/supabase/server";

export async function listPaymentTerms(onlyActive = true) {
  const supabase = await createClient();
  let query = supabase
    .from("payment_terms")
    .select("id, name, credit_days, payment_method, advance_percent, balance_percent, is_active")
    .order("credit_days");
  if (onlyActive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getPaymentTerm(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_terms")
    .select("id, name, credit_days, payment_method, advance_percent, balance_percent")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}
