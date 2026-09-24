import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, pageRange } from "@/lib/utils/pagination";

export type ClientListFilters = {
  stage?: "LEAD" | "PROSPECT" | "CLIENT";
  search?: string;
  /** "active" | "inactive"; sin valor = todos */
  status?: "active" | "inactive";
  page?: number;
};

/** Estados de factura con saldo por cobrar. */
const OPEN_INVOICE_STATUSES = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"];

/**
 * Lista paginada de clientes de la(s) compañía(s) del usuario actual (RLS
 * ya filtra por company_id + permiso), con el total para la paginación.
 */
export async function listClients(filters: ClientListFilters = {}) {
  const supabase = await createClient();
  const [from, to] = pageRange(filters.page ?? 1);
  let query = supabase
    .from("clients")
    .select("id, name, tax_id, email, phone, stage, is_active, created_at", { count: "exact" })
    .order("name", { ascending: true })
    .range(from, to);

  if (filters.stage) query = query.eq("stage", filters.stage);
  if (filters.search) query = query.ilike("name", `%${filters.search}%`);
  if (filters.status === "active") query = query.eq("is_active", true);
  if (filters.status === "inactive") query = query.eq("is_active", false);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: data, total: count ?? 0, pageSize: PAGE_SIZE };
}

/**
 * Conteos para el encabezado de /clients: cuántos hay por etapa (solo
 * activos, que es lo que interesa del pipeline) y el total por cobrar de
 * todas las facturas abiertas, en moneda base.
 */
export async function getClientStats() {
  const supabase = await createClient();
  const [clients, invoices] = await Promise.all([
    supabase.from("clients").select("stage, is_active"),
    supabase
      .from("invoices")
      .select("balance, exchange_rate")
      .in("status", OPEN_INVOICE_STATUSES)
      .gt("balance", 0),
  ]);
  if (clients.error) throw new Error(clients.error.message);
  if (invoices.error) throw new Error(invoices.error.message);

  /** Solo activos: para las tarjetas del pipeline. */
  const byStage: Record<string, number> = {};
  /** Activos e inactivos: para los conteos de los filtros por etapa. */
  const byStageAll: Record<string, number> = {};
  let inactive = 0;
  for (const c of clients.data ?? []) {
    byStageAll[c.stage] = (byStageAll[c.stage] ?? 0) + 1;
    if (!c.is_active) {
      inactive += 1;
      continue;
    }
    byStage[c.stage] = (byStage[c.stage] ?? 0) + 1;
  }
  const porCobrar = (invoices.data ?? []).reduce(
    (acc, i) => acc + Number(i.balance) * Number(i.exchange_rate ?? 1),
    0,
  );
  return { total: (clients.data ?? []).length, byStage, byStageAll, inactive, porCobrar };
}

/**
 * Por cada cliente de la página: cuántos proyectos activos tiene y cuánto
 * debe (facturas abiertas, moneda base). Una sola consulta por tabla, no
 * una por cliente.
 */
export async function getClientListAggregates(clientIds: string[]) {
  const result: Record<string, { activeProjects: number; porCobrar: number }> = {};
  if (clientIds.length === 0) return result;
  const supabase = await createClient();
  const [projects, invoices] = await Promise.all([
    supabase
      .from("projects")
      .select("client_id, status")
      .in("client_id", clientIds)
      .in("status", ["PLANNING", "CONFIRMED", "IN_PROGRESS"]),
    supabase
      .from("invoices")
      .select("client_id, balance, exchange_rate")
      .in("client_id", clientIds)
      .in("status", OPEN_INVOICE_STATUSES)
      .gt("balance", 0),
  ]);
  if (projects.error) throw new Error(projects.error.message);
  if (invoices.error) throw new Error(invoices.error.message);

  for (const id of clientIds) result[id] = { activeProjects: 0, porCobrar: 0 };
  for (const p of projects.data ?? []) result[p.client_id].activeProjects += 1;
  for (const i of invoices.data ?? []) {
    result[i.client_id].porCobrar += Number(i.balance) * Number(i.exchange_rate ?? 1);
  }
  return result;
}

/**
 * Historial comercial de un cliente para su detalle: cotizaciones,
 * facturas y proyectos, más los totales (moneda base, tasa congelada de
 * cada documento).
 */
export async function getClientActivity(clientId: string) {
  const supabase = await createClient();
  const [quotations, invoices, projects] = await Promise.all([
    supabase
      .from("quotations")
      .select("id, number, status, total, currency, exchange_rate, issue_date")
      .eq("client_id", clientId)
      .order("issue_date", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, number, status, total, balance, currency, exchange_rate, issue_date, due_date")
      .eq("client_id", clientId)
      .order("issue_date", { ascending: false }),
    supabase
      .from("projects")
      .select("id, number, name, status, event_date, budget")
      .eq("client_id", clientId)
      .order("event_date", { ascending: false, nullsFirst: false }),
  ]);
  for (const r of [quotations, invoices, projects]) {
    if (r.error) throw new Error(r.error.message);
  }

  const base = (amount: number, rate: number | null) => Number(amount) * Number(rate ?? 1);
  const q = quotations.data ?? [];
  const inv = invoices.data ?? [];
  const proj = projects.data ?? [];

  const cotizadoAprobado = q
    .filter((x) => x.status === "APPROVED")
    .reduce((acc, x) => acc + base(x.total, x.exchange_rate), 0);
  const facturado = inv
    .filter((x) => x.status !== "CANCELLED" && x.status !== "DRAFT")
    .reduce((acc, x) => acc + base(x.total, x.exchange_rate), 0);
  const porCobrar = inv
    .filter((x) => OPEN_INVOICE_STATUSES.includes(x.status))
    .reduce((acc, x) => acc + base(x.balance, x.exchange_rate), 0);
  const vencido = inv
    .filter((x) => x.status === "OVERDUE")
    .reduce((acc, x) => acc + base(x.balance, x.exchange_rate), 0);

  return {
    quotations: q,
    invoices: inv,
    projects: proj,
    totals: {
      cotizaciones: q.length,
      cotizadoAprobado,
      facturado,
      porCobrar,
      vencido,
      proyectosActivos: proj.filter((p) =>
        ["PLANNING", "CONFIRMED", "IN_PROGRESS"].includes(p.status),
      ).length,
    },
  };
}

/** Opciones para filtros por cliente (todos, incluidos inactivos, para poder ver su historial). */
export async function listClientOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, is_active")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function getClient(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listClientContacts(clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_contacts")
    .select("*")
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listImportBatches() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_batches")
    .select("*")
    .eq("entity_type", "clients")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data;
}
