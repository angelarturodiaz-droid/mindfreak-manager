import { createClient } from "@/lib/supabase/server";

export async function listInvoices(status?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select("id, number, status, total, paid_amount, balance, currency, issue_date, due_date, clients(name)")
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
    .select("*, clients(name), projects(number, name)")
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
    .select("id, name, unit, default_price")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}
