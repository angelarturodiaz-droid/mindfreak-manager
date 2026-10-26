import { createClient } from "@/lib/supabase/server";
import { getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { PAGE_SIZE, pageRange } from "@/lib/utils/pagination";
import { idsByName, searchOr } from "@/lib/utils/search";

export type ProjectListFilters = {
  status?: string;
  clientId?: string;
  /** Busca por número, nombre del evento, lugar o nombre del cliente. */
  search?: string;
  page?: number;
};

/** Lista paginada de proyectos (PAGE_SIZE por página) con el total para la paginación. */
export async function listProjects(filters: ProjectListFilters = {}) {
  const supabase = await createClient();
  const [from, to] = pageRange(filters.page ?? 1);
  let query = supabase
    .from("projects")
    .select(
      "id, number, name, status, event_date, event_time, location_name, budget, client_id, clients(name)",
      { count: "exact" },
    )
    // Más reciente primero (fecha del evento), igual que el resto de listas.
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("number", { ascending: false })
    .range(from, to);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.search) {
    const ids = await idsByName(supabase, "clients", filters.search);
    query = query.or(searchOr(filters.search, ["number", "name", "location_name"], { column: "client_id", ids }));
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: data, total: count ?? 0, pageSize: PAGE_SIZE };
}

/**
 * Conteos para el encabezado de /projects: cuántos hay por estado, cuántos
 * eventos activos caen en los próximos 30 días y el presupuesto de los
 * activos. Respeta el filtro de cliente para que los números coincidan con
 * la lista que se está viendo.
 */
export async function getProjectStats(clientId?: string) {
  const supabase = await createClient();
  let query = supabase.from("projects").select("status, event_date, budget");
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(
    new Date(),
  );
  const in30 = new Date(`${today}T00:00:00Z`);
  in30.setUTCDate(in30.getUTCDate() + 30);
  const limit = in30.toISOString().slice(0, 10);

  const byStatus: Record<string, number> = {};
  let active = 0;
  let upcoming = 0;
  let activeBudget = 0;
  for (const p of data ?? []) {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    const isActive = ["PLANNING", "CONFIRMED", "IN_PROGRESS"].includes(p.status);
    if (!isActive) continue;
    active += 1;
    activeBudget += Number(p.budget ?? 0);
    if (p.event_date && p.event_date >= today && p.event_date <= limit) upcoming += 1;
  }
  return { total: (data ?? []).length, byStatus, active, upcoming, activeBudget };
}

export async function getProject(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*, clients(name), quotations!quotation_id(number)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export type ProjectItem = {
  id: string;
  project_id: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  estimated_cost: number;
  subtotal: number;
  sort_order: number;
  source_quotation_id?: string | null;
  /** Cotización de donde viene la línea (pestaña Servicios). */
  source?: { number: string; status: string } | null;
};

export async function listProjectItems(projectId: string): Promise<ProjectItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_items")
    .select("*, source:quotations!source_quotation_id(number, status)")
    .eq("project_id", projectId)
    .order("sort_order");
  if (!error) {
    return (data ?? []).map((r) => ({
      ...r,
      source: (Array.isArray(r.source) ? r.source[0] : r.source) ?? null,
    })) as ProjectItem[];
  }
  // Antes de la migración 086 no existe el origen de la línea.
  const { data: plain, error: plainError } = await supabase
    .from("project_items")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");
  if (plainError) throw new Error(plainError.message);
  return (plain ?? []) as ProjectItem[];
}

/** Datos mínimos del proyecto (para la cotización adicional). */
export async function getProjectBasic(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, number, name, client_id, status")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Cotización creada desde las líneas de un proyecto sin cotización, si está en curso. */
export async function getOpenProjectQuotation(projectId: string): Promise<{ id: string; number: string; status: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("id, number, status")
    .eq("project_id", projectId)
    .eq("created_from_project", true)
    .in("status", ["DRAFT", "SENT", "VIEWED", "NEGOTIATING"])
    .maybeSingle();
  if (error) return null;
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

export const CONVERTIBLE_PAGE_SIZE = 5;

/**
 * Cotizaciones aprobadas que faltan por decidir: sin proyecto y SIN factura
 * (las que ya se facturaron sin proyecto no se convierten: una cotización =
 * una factura). Paginado de 5 en 5.
 */
export async function listConvertibleQuotations(page = 1): Promise<{
  rows: { id: string; number: string; total: number; currency: string; clients: unknown }[];
  total: number;
}> {
  const supabase = await createClient();
  const { data: invoiced } = await supabase
    .from("invoices")
    .select("quotation_id")
    .is("project_id", null)
    .not("quotation_id", "is", null)
    .neq("status", "CANCELLED");
  const invoicedIds = [...new Set((invoiced ?? []).map((r) => r.quotation_id as string))];
  const from = (page - 1) * CONVERTIBLE_PAGE_SIZE;
  let query = supabase
    .from("quotations")
    .select("id, number, total, currency, clients(name)", { count: "exact" })
    .eq("status", "APPROVED")
    .is("project_id", null)
    .order("issue_date", { ascending: false })
    .order("number", { ascending: false })
    .range(from, from + CONVERTIBLE_PAGE_SIZE - 1);
  if (invoicedIds.length) query = query.not("id", "in", `(${invoicedIds.join(",")})`);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0 };
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

/**
 * Rentabilidad del proyecto (F15), consolidado en la moneda base de la
 * empresa usando el `exchange_rate` ya congelado de cada registro (nunca la
 * tasa actual) — ver F0-Arquitectura, sección P.
 */
export async function getProjectProfitability(projectId: string) {
  const supabase = await createClient();

  const [quotations, invoices, customerPayments, projectItems, expenses, project] =
    await Promise.all([
      supabase
        .from("quotations")
        .select("total, exchange_rate")
        .eq("project_id", projectId)
        // Cotizado = lo que el cliente aprobó (la cotización del proyecto y las adicionales aprobadas).
        .eq("status", "APPROVED"),
      supabase
        .from("invoices")
        .select("total, exchange_rate")
        .eq("project_id", projectId)
        // Facturado = facturas emitidas (sin borradores ni canceladas).
        .not("status", "in", "(CANCELLED,DRAFT)"),
      supabase
        .from("customer_payments")
        .select("amount, exchange_rate")
        .eq("project_id", projectId),
      supabase
        .from("project_items")
        .select("estimated_cost")
        .eq("project_id", projectId),
      supabase
        .from("expenses")
        .select("total, exchange_rate")
        .eq("project_id", projectId)
        .neq("status", "CANCELLED"),
      supabase.from("projects").select("budget").eq("id", projectId).single(),
    ]);

  for (const r of [quotations, invoices, customerPayments, projectItems, expenses, project]) {
    if (r.error) throw new Error(r.error.message);
  }

  const sum = (rows: { amount?: number; total?: number; exchange_rate?: number }[] | null) =>
    (rows ?? []).reduce(
      (acc, r) => acc + (r.total ?? r.amount ?? 0) * (r.exchange_rate ?? 1),
      0,
    );

  const cotizado = sum(quotations.data);
  const facturado = sum(invoices.data);
  const cobrado = sum(customerPayments.data);
  const costoEstimado = (projectItems.data ?? []).reduce(
    (acc, r) => acc + r.estimated_cost,
    0,
  );
  const costoReal = sum(expenses.data);
  const presupuesto = project.data?.budget ?? 0;

  const utilidadEstimada = cotizado - costoEstimado;
  const utilidadReal = facturado - costoReal;

  return {
    cotizado,
    facturado,
    cobrado,
    costoEstimado,
    costoReal,
    utilidadEstimada,
    utilidadReal,
    margenEstimado: cotizado > 0 ? (utilidadEstimada / cotizado) * 100 : null,
    margenReal: facturado > 0 ? (utilidadReal / facturado) * 100 : null,
    presupuesto,
    presupuestoConsumidoPct: presupuesto > 0 ? (costoReal / presupuesto) * 100 : null,
  };
}

// ---- Vistas filtradas por proyecto para las pestañas del detalle (F15 fix) ----

export async function listProjectQuotations(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("id, number, status, currency, total, issue_date")
    .eq("project_id", projectId)
    .order("issue_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listProjectInvoices(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, number, status, currency, total, balance, issue_date")
    .eq("project_id", projectId)
    .order("issue_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listProjectCustomerPayments(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_payments")
    .select("id, payment_date, amount, currency, method, invoice_id, invoices(number)")
    .eq("project_id", projectId)
    .order("payment_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listProjectExpenses(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select(
      "id, description, status, currency, total, expense_date, suppliers(name)",
    )
    .eq("project_id", projectId)
    .order("expense_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listProjectSuppliers(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("supplier_id, total, exchange_rate, suppliers(name)")
    .eq("project_id", projectId)
    .not("supplier_id", "is", null)
    .neq("status", "CANCELLED");
  if (error) throw new Error(error.message);

  const bySupplier = new Map<string, { name: string; total: number }>();
  for (const row of data ?? []) {
    const supplierData = row.suppliers as { name: string }[] | { name: string } | null;
    const name = Array.isArray(supplierData) ? supplierData[0]?.name : supplierData?.name;
    const key = row.supplier_id as string;
    const current = bySupplier.get(key) ?? { name: name ?? "—", total: 0 };
    current.total += row.total * row.exchange_rate;
    bySupplier.set(key, current);
  }
  return Array.from(bySupplier.entries()).map(([supplierId, v]) => ({
    supplierId,
    ...v,
  }));
}

export async function listProjectSupplierPayments(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_payments")
    .select("id, payment_date, amount, currency, method, expense_id, suppliers(name)")
    .eq("project_id", projectId)
    .order("payment_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listProjectBankTransactions(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_transactions")
    .select(
      "id, type, amount, currency, transaction_date, description, bank_accounts!bank_transactions_bank_account_id_fkey(name), expense_categories(name)",
    )
    .eq("project_id", projectId)
    .order("transaction_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Datos para el aviso "Cotizado vs. facturado" (ver billing-progress.ts):
 * cotizaciones APROBADAS del proyecto, facturas emitidas (sin borradores ni
 * canceladas) y borradores aparte. En moneda base con la tasa congelada.
 */
export async function getProjectBilling(projectId: string) {
  const supabase = await createClient();
  const [quotations, invoices] = await Promise.all([
    supabase.from("quotations").select("total, exchange_rate").eq("project_id", projectId).eq("status", "APPROVED"),
    supabase.from("invoices").select("total, exchange_rate, status").eq("project_id", projectId).neq("status", "CANCELLED"),
  ]);
  if (quotations.error) throw new Error(quotations.error.message);
  if (invoices.error) throw new Error(invoices.error.message);
  const base = (r: { total: number | null; exchange_rate: number | null }) =>
    Number(r.total ?? 0) * Number(r.exchange_rate ?? 1);
  const rows = invoices.data ?? [];
  return {
    cotizado: (quotations.data ?? []).reduce((a, r) => a + base(r), 0),
    facturado: rows.filter((r) => r.status !== "DRAFT").reduce((a, r) => a + base(r), 0),
    borradores: rows.filter((r) => r.status === "DRAFT").reduce((a, r) => a + base(r), 0),
  };
}
