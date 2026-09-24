import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, pageRange } from "@/lib/utils/pagination";

export type InvoiceListFilters = {
  status?: string;
  clientId?: string;
  page?: number;
};

/** Lista paginada de facturas (PAGE_SIZE por página) con el total para la paginación. */
export async function listInvoices(filters: InvoiceListFilters = {}) {
  const supabase = await createClient();
  const [from, to] = pageRange(filters.page ?? 1);
  let query = supabase
    .from("invoices")
    .select(
      "id, number, status, total, paid_amount, balance, currency, issue_date, due_date, duplicated_from_id, clients(name)",
      { count: "exact" },
    )
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
 * Resumen para el encabezado de /invoices (solo lectura): conteo por
 * estado, por cobrar, vencido y lo que vence en los próximos 7 días, en
 * moneda base. "Vencido" incluye facturas abiertas con fecha de
 * vencimiento pasada aunque su estado todavía no se haya marcado Vencida.
 */
export async function getInvoiceStats(clientId?: string) {
  const supabase = await createClient();
  let query = supabase.from("invoices").select("status, balance, exchange_rate, due_date");
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(
    new Date(),
  );
  const in7 = new Date(`${today}T00:00:00Z`);
  in7.setUTCDate(in7.getUTCDate() + 7);
  const limit7 = in7.toISOString().slice(0, 10);

  const byStatus: Record<string, number> = {};
  let porCobrar = 0;
  let vencido = 0;
  let vencidoCount = 0;
  let dueSoon = 0;
  let dueSoonCount = 0;
  for (const inv of data ?? []) {
    byStatus[inv.status] = (byStatus[inv.status] ?? 0) + 1;
    if (!["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(inv.status)) continue;
    const bal = Number(inv.balance) * Number(inv.exchange_rate ?? 1);
    if (bal <= 0) continue;
    porCobrar += bal;
    if (inv.status === "OVERDUE" || (inv.due_date && inv.due_date < today)) {
      vencido += bal;
      vencidoCount += 1;
    } else if (inv.due_date && inv.due_date <= limit7) {
      dueSoon += bal;
      dueSoonCount += 1;
    }
  }
  return { total: (data ?? []).length, byStatus, porCobrar, vencido, vencidoCount, dueSoon, dueSoonCount };
}

export async function getInvoice(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "*, clients(name), projects(number, name), payment_terms(name), profiles!responsible_user_id(full_name), duplicated_from:invoices!duplicated_from_id(number)",
    )
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listInvoiceItems(invoiceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data;
}

export async function listActiveClients() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listProjectsForSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, number, name, client_id, clients(name)")
    .neq("status", "CANCELLED")
    .order("number", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listProjectItemsFor(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_items")
    .select("id, description, quantity, unit_price")
    .eq("project_id", projectId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data;
}

export async function listActiveServices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, unit, default_price, default_tax_rate_id, tax_rates(id, name, rate, treatment)")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

/** Usuarios de la compañía, para elegir el responsable de cobro de una factura. */
export async function listCompanyUsersForSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("profiles(id, full_name, email)");
  if (error) throw new Error(error.message);

  const seen = new Map<string, { id: string; full_name: string | null; email: string }>();
  for (const row of data ?? []) {
    const profile = row.profiles as
      | { id: string; full_name: string | null; email: string }
      | { id: string; full_name: string | null; email: string }[]
      | null;
    const p = Array.isArray(profile) ? profile[0] : profile;
    if (p && !seen.has(p.id)) seen.set(p.id, p);
  }
  return Array.from(seen.values()).sort((a, b) =>
    (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email),
  );
}

export async function listCollectionHistory(invoiceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice_collection_history")
    .select("id, action_date, action, comment, result, next_action_date, created_at, profiles(full_name)")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}
