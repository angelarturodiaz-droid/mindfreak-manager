import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, pageRange } from "@/lib/utils/pagination";

export type DeliveryListFilters = {
  status?: string;
  clientId?: string;
  type?: string;
  q?: string;
  page?: number;
};

/** Texto de búsqueda seguro para el filtro .or() de PostgREST. */
function searchTerm(q: string | undefined): string | null {
  const clean = (q ?? "").replace(/[,()%*\\]/g, " ").trim();
  return clean ? `%${clean}%` : null;
}

export async function listDeliveries(filters: DeliveryListFilters = {}) {
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const [from, to] = pageRange(page);

  let query = supabase
    .from("delivery_receipts")
    .select(
      "id, number, status, delivery_type, delivery_date, reference, recipient_name, signed_at, client_id, clients(name), projects(number, name), delivery_receipt_items(quantity)",
      { count: "exact" },
    )
    .order("delivery_date", { ascending: false })
    .order("number", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.type) query = query.eq("delivery_type", filters.type);
  const term = searchTerm(filters.q);
  if (term) query = query.or(`number.ilike.${term},reference.ilike.${term},recipient_name.ilike.${term}`);

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0, pageSize: PAGE_SIZE };
}

/** Conteos por estado (para los botones de filtro y las tarjetas de resumen). */
export async function getDeliveryStats(clientId?: string) {
  const supabase = await createClient();
  let query = supabase.from("delivery_receipts").select("status, delivery_date, signed_at");
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const byStatus: Record<string, number> = {};
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthKey = monthStart.toISOString().slice(0, 7);
  let signedThisMonth = 0;
  for (const r of data ?? []) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (r.status === "SIGNED" && r.signed_at && String(r.signed_at).slice(0, 7) === monthKey) signedThisMonth++;
  }
  return { total: (data ?? []).length, byStatus, signedThisMonth };
}

export async function getDelivery(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delivery_receipts")
    .select(
      "*, clients(id, name, tax_id), projects(id, number, name), created_by_profile:profiles!delivery_receipts_created_by_fkey(full_name), signed_by_profile:profiles!delivery_receipts_signed_by_fkey(full_name)",
    )
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listDeliveryItems(receiptId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delivery_receipt_items")
    .select("id, position, description, reference, quantity")
    .eq("receipt_id", receiptId)
    .order("position");
  if (error) throw new Error(error.message);
  return (data ?? []).map((i) => ({ ...i, quantity: Number(i.quantity) }));
}

/** Historial de entregas de un cliente (pestaña "Entregas" del cliente). */
export async function listDeliveriesForClient(clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delivery_receipts")
    .select("id, number, status, delivery_type, delivery_date, reference, signed_at, received_by_name, delivery_receipt_items(quantity)")
    .eq("client_id", clientId)
    .order("delivery_date", { ascending: false })
    .order("number", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Clientes y proyectos para el formulario. */
export async function listDeliveryFormOptions() {
  const supabase = await createClient();
  const [{ data: clients, error: cError }, { data: projects, error: pError }] = await Promise.all([
    supabase.from("clients").select("id, name, is_active").order("name"),
    supabase.from("projects").select("id, number, name, client_id").order("number", { ascending: false }),
  ]);
  if (cError) throw new Error(cError.message);
  if (pError) throw new Error(pError.message);
  return { clients: clients ?? [], projects: projects ?? [] };
}
