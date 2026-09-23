import { createClient } from "@/lib/supabase/server";

export async function listInvoices(status?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select(
      "id, number, status, total, paid_amount, balance, currency, issue_date, due_date, duplicated_from_id, clients(name)",
    )
    .order("issue_date", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
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
