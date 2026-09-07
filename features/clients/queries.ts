import { createClient } from "@/lib/supabase/server";

export type ClientListFilters = {
  status?: "LEAD" | "ACTIVE";
  search?: string;
};

/** Lista clientes de la(s) compañía(s) del usuario actual (RLS ya filtra por company_id + permiso). */
export async function listClients(filters: ClientListFilters = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select("id, name, email, phone, status, is_active, created_at")
    .order("created_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getClient(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listClientContacts(clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_contacts")
    .select("*")
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listImportBatches() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_batches")
    .select("*")
    .eq("entity_type", "clients")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data;
}
