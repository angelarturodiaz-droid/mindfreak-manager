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
    .select("id, number, status, total, currency, issue_date, duplicated_from_id, clients(name)", {
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
