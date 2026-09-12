import { createClient } from "@/lib/supabase/server";

// ---- Catálogos para los selects de filtro ----

export async function listClientsForFilter() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listSuppliersForFilter() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("suppliers").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listProjectsForFilter() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, number, name")
    .order("number", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listExpenseCategoriesForFilter() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .select("id, name")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listManagersForFilter() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("manager_id, profiles!manager_id(id, full_name)")
    .not("manager_id", "is", null);
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  const managers: { id: string; full_name: string | null }[] = [];
  for (const row of data ?? []) {
    const profile = row.profiles as
      | { id: string; full_name: string | null }
      | { id: string; full_name: string | null }[]
      | null;
    const p = Array.isArray(profile) ? profile[0] : profile;
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      managers.push(p);
    }
  }
  return managers;
}

// ---- Reportes ----

export type ProfitabilityFilters = {
  from?: string;
  to?: string;
  projectId?: string;
  clientId?: string;
  status?: string;
  managerId?: string;
};

/**
 * Rentabilidad de proyectos (filtrable). Período = `projects.event_date`.
 */
export async function getProjectsProfitabilityReport(filters: ProfitabilityFilters = {}) {
  const supabase = await createClient();

  let projectsQuery = supabase
    .from("projects")
    .select("id, number, name, status, budget")
    .order("number", { ascending: false });
  if (filters.from) projectsQuery = projectsQuery.gte("event_date", filters.from);
  if (filters.to) projectsQuery = projectsQuery.lte("event_date", filters.to);
  if (filters.projectId) projectsQuery = projectsQuery.eq("id", filters.projectId);
  if (filters.clientId) projectsQuery = projectsQuery.eq("client_id", filters.clientId);
  if (filters.status) projectsQuery = projectsQuery.eq("status", filters.status);
  if (filters.managerId) projectsQuery = projectsQuery.eq("manager_id", filters.managerId);

  const { data: projects, error: projectsError } = await projectsQuery;
  if (projectsError) throw new Error(projectsError.message);
  if (!projects || projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);

  const [quotations, invoices, payments, items, expenses] = await Promise.all([
    supabase.from("quotations").select("project_id, total, exchange_rate").in("project_id", projectIds),
    supabase
      .from("invoices")
      .select("project_id, total, exchange_rate")
      .in("project_id", projectIds)
      .neq("status", "CANCELLED"),
    supabase.from("customer_payments").select("project_id, amount, exchange_rate").in("project_id", projectIds),
    supabase.from("project_items").select("project_id, estimated_cost").in("project_id", projectIds),
    supabase
      .from("expenses")
      .select("project_id, total, exchange_rate")
      .in("project_id", projectIds)
      .neq("status", "CANCELLED"),
  ]);
  for (const r of [quotations, invoices, payments, items, expenses]) {
    if (r.error) throw new Error(r.error.message);
  }

  function groupSum(
    rows: { project_id: string; total?: number; amount?: number; exchange_rate?: number }[] | null,
  ) {
    const map = new Map<string, number>();
    for (const r of rows ?? []) {
      const v = (r.total ?? r.amount ?? 0) * (r.exchange_rate ?? 1);
      map.set(r.project_id, (map.get(r.project_id) ?? 0) + v);
    }
    return map;
  }

  const cotizadoMap = groupSum(quotations.data);
  const facturadoMap = groupSum(invoices.data);
  const cobradoMap = groupSum(payments.data);
  const costoRealMap = groupSum(expenses.data);
  const costoEstimadoMap = new Map<string, number>();
  for (const r of items.data ?? []) {
    costoEstimadoMap.set(r.project_id, (costoEstimadoMap.get(r.project_id) ?? 0) + r.estimated_cost);
  }

  return projects.map((p) => {
    const cotizado = cotizadoMap.get(p.id) ?? 0;
    const facturado = facturadoMap.get(p.id) ?? 0;
    const cobrado = cobradoMap.get(p.id) ?? 0;
    const costoEstimado = costoEstimadoMap.get(p.id) ?? 0;
    const costoReal = costoRealMap.get(p.id) ?? 0;
    const utilidadReal = facturado - costoReal;
    return {
      ...p,
      cotizado,
      facturado,
      cobrado,
      costoEstimado,
      costoReal,
      utilidadReal,
      margenReal: facturado > 0 ? (utilidadReal / facturado) * 100 : null,
    };
  });
}

export type ReceivableFilters = {
  from?: string;
  to?: string;
  clientId?: string;
  status?: string;
  projectId?: string;
  currency?: string;
};

const PENDING_INVOICE_STATUSES = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"];

/** Cuentas por cobrar. Período = fecha de factura (`issue_date`). */
export async function getAccountsReceivableReport(filters: ReceivableFilters = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select("id, number, due_date, balance, currency, exchange_rate, status, clients(name)")
    .order("due_date", { ascending: true, nullsFirst: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  } else {
    query = query.in("status", PENDING_INVOICE_STATUSES).gt("balance", 0);
  }
  if (filters.from) query = query.gte("issue_date", filters.from);
  if (filters.to) query = query.lte("issue_date", filters.to);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.currency) query = query.eq("currency", filters.currency);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const today = new Date();
  return (data ?? []).map((inv) => {
    const daysOverdue = inv.due_date
      ? Math.max(0, Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000))
      : 0;
    return { ...inv, daysOverdue };
  });
}

export type PayableFilters = {
  from?: string;
  to?: string;
  supplierId?: string;
  status?: string;
  projectId?: string;
  currency?: string;
};

const PENDING_EXPENSE_STATUSES = ["PENDING", "PARTIALLY_PAID"];

/** Cuentas por pagar. Período = fecha del gasto (`expense_date`). */
export async function getAccountsPayableReport(filters: PayableFilters = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select("id, description, expense_date, balance, currency, exchange_rate, status, suppliers(name)")
    .order("expense_date", { ascending: true });

  if (filters.status) {
    query = query.eq("status", filters.status);
  } else {
    query = query.in("status", PENDING_EXPENSE_STATUSES).gt("balance", 0);
  }
  if (filters.from) query = query.gte("expense_date", filters.from);
  if (filters.to) query = query.lte("expense_date", filters.to);
  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.currency) query = query.eq("currency", filters.currency);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type SalesByClientFilters = {
  from?: string;
  to?: string;
  clientId?: string;
  projectId?: string;
  status?: string;
  currency?: string;
};

/** Ventas totales por cliente. Período = fecha de factura (`issue_date`). */
export async function getSalesByClientReport(filters: SalesByClientFilters = {}) {
  const supabase = await createClient();
  let query = supabase.from("invoices").select("client_id, total, exchange_rate, clients(name)");

  if (filters.status) {
    query = query.eq("status", filters.status);
  } else {
    query = query.neq("status", "CANCELLED");
  }
  if (filters.from) query = query.gte("issue_date", filters.from);
  if (filters.to) query = query.lte("issue_date", filters.to);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.currency) query = query.eq("currency", filters.currency);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const map = new Map<string, { name: string; total: number }>();
  for (const row of data ?? []) {
    const clientData = row.clients as { name: string }[] | { name: string } | null;
    const name = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;
    const key = row.client_id as string;
    const current = map.get(key) ?? { name: name ?? "—", total: 0 };
    current.total += row.total * row.exchange_rate;
    map.set(key, current);
  }
  return Array.from(map.entries())
    .map(([clientId, v]) => ({ clientId, ...v }))
    .sort((a, b) => b.total - a.total);
}

export type ExpensesByCategoryFilters = {
  from?: string;
  to?: string;
  categoryId?: string;
  projectId?: string;
  supplierId?: string;
  status?: string;
};

/** Gastos totales por categoría. Período = fecha del gasto (`expense_date`). */
export async function getExpensesByCategoryReport(filters: ExpensesByCategoryFilters = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select("category_id, total, exchange_rate, expense_categories(name)");

  if (filters.status) {
    query = query.eq("status", filters.status);
  } else {
    query = query.neq("status", "CANCELLED");
  }
  if (filters.from) query = query.gte("expense_date", filters.from);
  if (filters.to) query = query.lte("expense_date", filters.to);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const map = new Map<string, { name: string; total: number }>();
  for (const row of data ?? []) {
    const categoryData = row.expense_categories as { name: string }[] | { name: string } | null;
    const name = Array.isArray(categoryData) ? categoryData[0]?.name : categoryData?.name;
    const key = (row.category_id as string | null) ?? "sin-categoria";
    const current = map.get(key) ?? { name: name ?? "Sin categoría", total: 0 };
    current.total += row.total * row.exchange_rate;
    map.set(key, current);
  }
  return Array.from(map.entries())
    .map(([categoryId, v]) => ({ categoryId, ...v }))
    .sort((a, b) => b.total - a.total);
}
