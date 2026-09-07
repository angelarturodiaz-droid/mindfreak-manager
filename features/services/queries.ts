import { createClient } from "@/lib/supabase/server";

export async function listServiceCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_categories")
    .select("id, name, description")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listServices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select(
      "id, name, unit, default_price, default_cost, is_active, category_id, service_categories(name)",
    )
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function getService(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}
