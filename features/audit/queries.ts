import { createClient } from "@/lib/supabase/server";

export async function listAuditLogs(filters: { entityType?: string; action?: string } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, old_values, new_values, created_at, profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.action) query = query.eq("action", filters.action);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function listAuditEntityTypes() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("audit_logs").select("entity_type");
  if (error) throw new Error(error.message);
  return Array.from(new Set((data ?? []).map((r) => r.entity_type))).sort();
}
