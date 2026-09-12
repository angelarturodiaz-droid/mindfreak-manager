import { createClient } from "@/lib/supabase/server";

/**
 * Rentabilidad de todos los proyectos, mismo cálculo que
 * getProjectProfitability (F15) pero agregado para todos a la vez —
 * evita N+1 queries haciendo 5 consultas totales en vez de 5 por proyecto.
 */
export async function getProjectsProfitabilityReport() {
  const supabase = await createClient();

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, number, name, status, budget")
    .order("number", { ascending: false });
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

/** Cuentas por cobrar: facturas con balance pendiente, con antigüedad. */
export async function getAccountsReceivableReport() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, number, due_date, balance, currency, exchange_rate, status, clients(name)")
    .in("status", ["ISSUED", "PARTIALLY_PAID", "OVERDUE"])
    .gt("balance", 0)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);

  const today = new Date();
  return (data ?? []).map((inv) => {
    const daysOverdue = inv.due_date
      ? Math.max(0, Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000))
      : 0;
    return { ...inv, daysOverdue };
  });
}

/** Cuentas por pagar: gastos con balance pendiente. */
export async function getAccountsPayableReport() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("id, description, expense_date, balance, currency, exchange_rate, status, suppliers(name)")
    .in("status", ["PENDING", "PARTIALLY_PAID"])
    .gt("balance", 0)
    .order("expense_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Ventas totales por cliente (facturado, excluyendo canceladas). */
export async function getSalesByClientReport() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("client_id, total, exchange_rate, clients(name)")
    .neq("status", "CANCELLED");
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

/** Gastos totales por categoría (excluyendo cancelados). */
export async function getExpensesByCategoryReport() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("category_id, total, exchange_rate, expense_categories(name)")
    .neq("status", "CANCELLED");
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
