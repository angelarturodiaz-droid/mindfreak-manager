import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, pageRange } from "@/lib/utils/pagination";
import { idsByName, searchOr } from "@/lib/utils/search";
import { todayISO } from "@/lib/utils/dates";
import { effectiveQuotationStatus } from "./expired";

export type QuotationListFilters = {
  status?: string;
  clientId?: string;
  /** Busca por número, título o nombre del cliente. */
  search?: string;
  page?: number;
};

/** Lista paginada de cotizaciones (PAGE_SIZE por página) con el total para la paginación. */
export async function listQuotations(filters: QuotationListFilters = {}) {
  const supabase = await createClient();
  const [from, to] = pageRange(filters.page ?? 1);
  let query = supabase
    .from("quotations")
    .select("id, number, status, total, currency, issue_date, valid_until, duplicated_from_id, project_id, project:projects!project_id(number, name), clients(name)", {
      count: "exact",
    })
    // Lo último que se registró sale primero (mismo criterio en todas las listas).
    .order("created_at", { ascending: false })
    .range(from, to);

  // "Expirada" se calcula por la validez (ver expired.ts). Enviada, Vista y En
  // negociación excluyen las ya expiradas para que los conteos cuadren.
  const today = todayISO();
  if (filters.status === "EXPIRED") {
    query = query.or(`status.eq.EXPIRED,and(status.in.(SENT,VIEWED,NEGOTIATING),valid_until.lt.${today})`);
  } else if (filters.status === "SENT" || filters.status === "VIEWED" || filters.status === "NEGOTIATING") {
    query = query.eq("status", filters.status).or(`valid_until.is.null,valid_until.gte.${today}`);
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.search) {
    const ids = await idsByName(supabase, "clients", filters.search);
    query = query.or(searchOr(filters.search, ["number"], { column: "client_id", ids }));
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((q) => ({ ...q, display_status: effectiveQuotationStatus(q, today) }));
  return { rows, total: count ?? 0, pageSize: PAGE_SIZE };
}

/**
 * Resumen para el encabezado de /quotations (solo lectura): conteo por
 * estado y montos en moneda base. Respeta el filtro de cliente.
 */
export async function getQuotationStats(clientId?: string) {
  const supabase = await createClient();
  let query = supabase.from("quotations").select("status, total, exchange_rate, valid_until");
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const today = todayISO();
  const byStatus: Record<string, number> = {};
  let followUpCount = 0;
  let followUpValue = 0;
  let approvedValue = 0;
  for (const q of data ?? []) {
    const shown = effectiveQuotationStatus(q, today);
    byStatus[shown] = (byStatus[shown] ?? 0) + 1;
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
    .select("*, clients(name, stage), payment_terms(name), duplicated_from:quotations!duplicated_from_id(number), project:projects!project_id(number, name)")
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
    .select("id, name, unit, default_price, default_cost, default_tax_rate_id, tax_rates(id, name, rate, treatment), service_categories(name)")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

/** Facturas hechas desde esta cotización sin proyecto (venta sin evento), sin las canceladas. */
export async function listDirectInvoicesFromQuotation(quotationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, number, status, total, currency")
    .eq("quotation_id", quotationId)
    .is("project_id", null)
    .neq("status", "CANCELLED")
    .order("created_at");
  if (error) return [];
  return data;
}
