import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, pageRange } from "@/lib/utils/pagination";

/** Registro de auditoría paginado (PAGE_SIZE), del más reciente al más antiguo. */
export async function listAuditLogs(filters: { entityType?: string; action?: string; page?: number } = {}) {
  const supabase = await createClient();
  const [from, to] = pageRange(filters.page ?? 1);
  let query = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, old_values, new_values, created_at, profiles(full_name, email)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.action) query = query.eq("action", filters.action);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0, pageSize: PAGE_SIZE };
}

export async function listAuditEntityTypes() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("audit_logs").select("entity_type");
  if (error) throw new Error(error.message);
  return Array.from(new Set((data ?? []).map((r) => r.entity_type))).sort();
}
