import { createClient } from "@/lib/supabase/server";
import { getCurrentUserCompanyIds } from "@/lib/auth/permissions";

export async function listProjects(status?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select("id, number, name, status, event_date, budget, clients(name)")
    .order("event_date", { ascending: true, nullsFirst: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getProject(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*, clients(name), quotations(number)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listProjectItems(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_items")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data;
}

export async function listActiveClients() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, status")
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
    .select("id, name, unit, default_price, default_cost")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

/** Usuarios de la compañía actual, para asignar como manager del proyecto. */
export async function listCompanyMembers() {
  const supabase = await createClient();
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) return [];

  const { data, error } = await supabase
    .from("user_roles")
    .select("profiles(id, full_name, email)")
    .eq("company_id", companyIds[0]);
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  type ProfileRow = { id: string; full_name: string | null; email: string | null };
  const members: ProfileRow[] = [];
  for (const row of data ?? []) {
    const profile = row.profiles as unknown as ProfileRow | ProfileRow[] | null;
    const p = Array.isArray(profile) ? profile[0] : profile;
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      members.push(p);
    }
  }
  return members;
}

/** Cotizaciones aprobadas que aún no se han convertido en proyecto. */
export async function listConvertibleQuotations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("id, number, total, currency, clients(name)")
    .eq("status", "APPROVED")
    .is("project_id", null)
    .order("issue_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getQuotationForConversion(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("*, clients(name)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listQuotationItemsFor(quotationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data;
}
