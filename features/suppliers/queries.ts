import { createClient } from "@/lib/supabase/server";

export async function listSuppliers(search?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("suppliers")
    .select("id, name, category, email, phone, is_active, created_at")
    .order("created_at", { ascending: false });

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getSupplier(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listSupplierContacts(supplierId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_contacts")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("is_primary", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}
