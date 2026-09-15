import { createClient } from "@/lib/supabase/server";

export async function listBankCatalog(onlyActive = true) {
  const supabase = await createClient();
  let query = supabase.from("bank_catalog").select("id, name, is_active").order("name");
  if (onlyActive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
