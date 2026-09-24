import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, pageRange } from "@/lib/utils/pagination";

export type QuotationListFilters = {
  status?: string;
  clientId?: string;
  page?: number;
};

/** Lista paginada de cotizaciones (PAGE_SIZE por página) con el total para la paginación. */
export async function listQuotations(filters: QuotationListFilters = {}) {
  const supabase = await createClient();
  const [from, to] = pageRange(filters.page ?? 1);
  let query = supabase
    .from("quotations")
    .select("id, number, status, total, currency, issue_date, valid_until, duplicated_from_id, clients(name)", {
      count: "exact",
    })
    .order("issue_date", { ascending: false })
    .order("number", { ascending: false })
    .range(from, to);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: data, total: count ?? 0, pageSize: PAGE_SIZE };
}

/**
 * Resumen para el encabezado de /quotations (solo lectura): conteo por
 * estado y montos en moneda base. Respeta el filtro de cliente.
 */
export async function getQuotationStats(clientId?: string) {
  const supabase = await createClient();
  let query = supabase.from("quotations").select("status, total, exchange_rate");
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const byStatus: Record<string, number> = {};
  let followUpCount = 0;
  let followUpValue = 0;
  let approvedValue = 0;
  for (const q of data ?? []) {
    byStatus[q.status] = (byStatus[q.status] ?? 0) + 1;
    const value = Number(q.total) * Number(q.exchange_rate ?? 1);
    if (["SENT", "VIEWED", "NEGOTIATING"].includes(q.status)) {
      followUpCount += 1;
      followUpValue += value;
    }
    if (q.status === "APPROVED") approvedValue += value;
  }
  const approved = byStatus.APPROVED ?? 0;
  const rejected = byStatus.REJECTED ?? 0;
  return {
    total: (data ?? []).length,
    byStatus,
    followUpCount,
    followUpValue,
    approvedValue,
    approvalRate: approved + rejected > 0 ? (approved / (approved + rejected)) * 100 : null,
  };
}

export async function getQuotation(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("*, clients(name, stage), payment_terms(name), duplicated_from:quotations!duplicated_from_id(number)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listQuotationItems(quotationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data;
}

export async function listActiveClients() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, stage")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listClientContactsFor(clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_contacts")
    .select("id, full_name")
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listActiveServices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, unit, default_price, default_cost, default_tax_rate_id, tax_rates(id, name, rate, treatment)")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}
