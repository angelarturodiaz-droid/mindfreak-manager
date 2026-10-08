import { createClient } from "@/lib/supabase/server";
import {
  summarizePaymentsByCurrency,
  toPaymentFxRow,
  type PaymentFxRow,
  type RawFxPayment,
} from "./payments-by-currency";

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
      // Facturado = facturas emitidas (sin borradores ni canceladas).
      .not("status", "in", "(CANCELLED,DRAFT)"),
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

  if (filters.status === "OVERDUE") {
    // Vencida = abierta con balance y vencimiento pasado (ver features/invoices/overdue.ts).
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(new Date());
    query = query
      .in("status", PENDING_INVOICE_STATUSES)
      .gt("balance", 0)
      .or(`status.eq.OVERDUE,due_date.lt.${today}`);
  } else if (filters.status) {
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
    // Sin filtro: ventas = facturas emitidas (sin borradores ni canceladas).
    query = query.not("status", "in", "(CANCELLED,DRAFT)");
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

/**
 * Dashboard de Cuentas por Cobrar y Vencimientos (Fase 2 del módulo
 * financiero avanzado). Reutiliza el mismo set base de facturas
 * pendientes que getAccountsReceivableReport, agregado en cubos de
 * vencimiento, más el estado de las cotizaciones (pendientes de
 * aceptación / aceptadas sin facturar todavía).
 */
export async function getReceivablesDashboard() {
  const supabase = await createClient();

  const [{ data: invoices, error: invError }, { data: pendingQuotes, error: pqError }, { data: approvedQuotes, error: aqError }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("id, number, due_date, balance, currency, exchange_rate, status, clients(name)")
        .in("status", PENDING_INVOICE_STATUSES)
        .gt("balance", 0)
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("quotations")
        .select("id, number, total, currency, exchange_rate, status, valid_until, clients(name)")
        .in("status", ["SENT", "VIEWED", "NEGOTIATING"])
        .order("valid_until", { ascending: true, nullsFirst: false }),
      supabase
        .from("quotations")
        .select("id, number, total, currency, exchange_rate, clients(name), invoices(id)")
        .eq("status", "APPROVED"),
    ]);

  if (invError) throw new Error(invError.message);
  if (pqError) throw new Error(pqError.message);
  if (aqError) throw new Error(aqError.message);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const withDaysUntilDue = (invoices ?? []).map((inv) => {
    const daysUntilDue = inv.due_date
      ? Math.round((new Date(inv.due_date).getTime() - today.getTime()) / 86400000)
      : null;
    return { ...inv, daysUntilDue };
  });

  const convertedSum = (rows: { balance: number; exchange_rate: number }[]) =>
    rows.reduce((acc, r) => acc + r.balance * r.exchange_rate, 0);

  const vencidas = withDaysUntilDue.filter((i) => i.daysUntilDue !== null && i.daysUntilDue < 0);
  const venceHoy = withDaysUntilDue.filter((i) => i.daysUntilDue === 0);
  const proximas7 = withDaysUntilDue.filter((i) => i.daysUntilDue !== null && i.daysUntilDue > 0 && i.daysUntilDue <= 7);
  const proximas15 = withDaysUntilDue.filter((i) => i.daysUntilDue !== null && i.daysUntilDue > 0 && i.daysUntilDue <= 15);
  const proximas30 = withDaysUntilDue.filter((i) => i.daysUntilDue !== null && i.daysUntilDue > 0 && i.daysUntilDue <= 30);

  // Cotizaciones aprobadas que todavía no generaron ninguna factura.
  const acceptedNotInvoiced = (approvedQuotes ?? []).filter((q) => {
    const invoicesData = q.invoices as { id: string }[] | { id: string } | null;
    const list = Array.isArray(invoicesData) ? invoicesData : invoicesData ? [invoicesData] : [];
    return list.length === 0;
  });

  return {
    totalPorCobrar: convertedSum(withDaysUntilDue),
    totalVencido: convertedSum(vencidas),
    totalVenceHoy: convertedSum(venceHoy),
    totalProximos7: convertedSum(proximas7),
    totalProximos15: convertedSum(proximas15),
    totalProximos30: convertedSum(proximas30),
    facturasVencidas: vencidas.map((i) => ({ ...i, daysOverdue: Math.abs(i.daysUntilDue ?? 0) })),
    facturasProximasAVencer: withDaysUntilDue.filter(
      (i) => i.daysUntilDue !== null && i.daysUntilDue >= 0 && i.daysUntilDue <= 30,
    ),
    cotizacionesPendientes: pendingQuotes ?? [],
    cotizacionesAceptadasSinFacturar: acceptedNotInvoiced,
  };
}

export async function listBankAccountsForFilter() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("id, name, currency, type")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

/** Origen del movimiento de banco, para filtrar el reporte de flujo por categoría. */
export const CASHFLOW_ORIGINS = {
  cobros: "Cobros de clientes",
  proveedores: "Pagos a proveedores",
  gastos: "Gastos sin proveedor",
  manuales: "Movimientos manuales",
  transferencias: "Transferencias entre cuentas",
} as const;
export type CashflowOrigin = keyof typeof CASHFLOW_ORIGINS;

export type CashflowByCategoryFilters = {
  from?: string;
  to?: string;
  bankAccountId?: string;
  /** Id de proyecto, o "none" = sin proyecto (gastos/ingresos generales de la empresa). */
  projectId?: string;
  clientId?: string;
  supplierId?: string;
  /** Id de categoría, o "none" = sin categoría. */
  categoryId?: string;
  origin?: CashflowOrigin;
  /** "in" = solo entradas de dinero, "out" = solo salidas. */
  direction?: "in" | "out";
  /** Las transferencias entre cuentas propias no son ingreso ni gasto: fuera por defecto. */
  includeTransfers?: boolean;
};

export type CashflowCategoryRow = {
  categoryId: string;
  name: string;
  ingresos: number;
  egresos: number;
  neto: number;
  count: number;
  /** Neto por mes (YYYY-MM). */
  byMonth: Record<string, number>;
};

/**
 * Ingresos y egresos por categoría a partir de los movimientos de banco
 * (flujo de caja real, como el Excel de control). Tipo y Categoría son
 * independientes: una misma categoría puede tener ingresos y egresos.
 *
 * - Ingreso = movimiento INCOME; egreso = EXPENSE (se guarda en positivo).
 * - Transferencias: excluidas salvo includeTransfers; si se incluyen, la
 *   fila que entra cuenta como ingreso y la que sale como egreso.
 * - Montos en moneda base: amount × exchange_rate de cada movimiento.
 * - "Sin categoría" es una fila propia para que se vea lo que falta clasificar.
 */
export async function getCashflowByCategoryReport(filters: CashflowByCategoryFilters = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("bank_transactions")
    .select("type, amount, exchange_rate, transaction_date, category_id, expense_categories(name)");

  // Elegir "Transferencias" como origen las incluye aunque la casilla esté apagada.
  const includeTransfers = filters.includeTransfers || filters.origin === "transferencias";
  if (!includeTransfers) query = query.neq("type", "TRANSFER");
  if (filters.from) query = query.gte("transaction_date", filters.from);
  if (filters.to) query = query.lte("transaction_date", filters.to);
  if (filters.bankAccountId) query = query.eq("bank_account_id", filters.bankAccountId);
  if (filters.projectId === "none") query = query.is("project_id", null);
  else if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
  if (filters.categoryId === "none") query = query.is("category_id", null);
  else if (filters.categoryId) query = query.eq("category_id", filters.categoryId);

  switch (filters.origin) {
    case "cobros":
      query = query.not("customer_payment_id", "is", null);
      break;
    case "proveedores":
      query = query.not("supplier_id", "is", null);
      break;
    case "gastos":
      query = query.not("expense_id", "is", null).is("supplier_id", null);
      break;
    case "manuales":
      query = query
        .is("customer_payment_id", null)
        .is("supplier_payment_id", null)
        .is("expense_id", null)
        .neq("type", "TRANSFER");
      break;
    case "transferencias":
      query = query.eq("type", "TRANSFER");
      break;
  }

  // Entradas: ingresos y transferencias recibidas. Salidas: egresos y transferencias enviadas.
  if (filters.direction === "in") query = query.or("type.eq.INCOME,and(type.eq.TRANSFER,amount.gt.0)");
  if (filters.direction === "out") query = query.or("type.eq.EXPENSE,and(type.eq.TRANSFER,amount.lt.0)");

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const map = new Map<string, CashflowCategoryRow>();
  const months = new Set<string>();
  for (const row of data ?? []) {
    const rate = Number(row.exchange_rate ?? 1);
    const amount = Number(row.amount);
    let ingreso = 0;
    let egreso = 0;
    if (row.type === "INCOME") ingreso = amount * rate;
    else if (row.type === "EXPENSE") egreso = amount * rate;
    else if (row.type === "TRANSFER") {
      if (amount >= 0) ingreso = amount * rate;
      else egreso = -amount * rate;
    }

    const categoryData = row.expense_categories as { name: string }[] | { name: string } | null;
    const name = Array.isArray(categoryData) ? categoryData[0]?.name : categoryData?.name;
    const key = (row.category_id as string | null) ?? "sin-categoria";
    const current =
      map.get(key) ??
      ({ categoryId: key, name: name ?? "Sin categoría", ingresos: 0, egresos: 0, neto: 0, count: 0, byMonth: {} } as CashflowCategoryRow);
    current.ingresos += ingreso;
    current.egresos += egreso;
    current.neto += ingreso - egreso;
    current.count += 1;
    const month = String(row.transaction_date).slice(0, 7);
    months.add(month);
    current.byMonth[month] = (current.byMonth[month] ?? 0) + ingreso - egreso;
    map.set(key, current);
  }

  const rows = Array.from(map.values()).sort(
    (a, b) => b.ingresos + b.egresos - (a.ingresos + a.egresos),
  );
  const totals = rows.reduce(
    (acc, r) => ({
      ingresos: acc.ingresos + r.ingresos,
      egresos: acc.egresos + r.egresos,
      neto: acc.neto + r.neto,
    }),
    { ingresos: 0, egresos: 0, neto: 0 },
  );
  const uncategorized = map.get("sin-categoria");
  return {
    rows,
    months: Array.from(months).sort(),
    totals,
    uncategorized: uncategorized
      ? { count: uncategorized.count, amount: uncategorized.ingresos + uncategorized.egresos }
      : { count: 0, amount: 0 },
  };
}

// ---- Multimoneda V5 (paso 5): Pagos y cobros por moneda ----

export type PaymentsByCurrencyFilters = {
  from?: string;
  to?: string;
  /** "in" = solo cobros, "out" = solo pagos a proveedores. */
  direction?: "in" | "out";
  bankAccountId?: string;
  /** Moneda del documento (factura o gasto). */
  currency?: string;
  clientId?: string;
  supplierId?: string;
  /** Solo los que se hicieron desde/hacia una cuenta en otra moneda. */
  onlyForeign?: boolean;
};

const FX_COLUMNS =
  "id, payment_date, amount, currency, exchange_rate, account_currency, account_amount, bank_fee_amount, functional_currency, functional_amount, effective_rate, effective_rate_currency, reference_rate, reference_rate_document, rate_manual_override, rounding_difference, informative_difference, bank_account_id, bank_accounts(name)";

/**
 * Cobros y pagos a proveedores con lo aplicado al documento, lo que se
 * movió en el banco (en la moneda de la cuenta), comisión, tasas y
 * diferencias. Período = fecha del pago/cobro.
 */
export async function getPaymentsByCurrencyReport(filters: PaymentsByCurrencyFilters = {}) {
  const supabase = await createClient();
  const { data: company } = await supabase.from("companies").select("base_currency").limit(1).single();
  const functional = company?.base_currency ?? "DOP";

  const wantCobros = filters.direction !== "out" && !filters.supplierId;
  const wantPagos = filters.direction !== "in" && !filters.clientId;

  const fetchCobros = async () => {
    if (!wantCobros) return { data: [] as unknown[], error: null };
    let q = supabase.from("customer_payments").select(`${FX_COLUMNS}, invoice_id, invoices(number), clients(name)`);
    if (filters.from) q = q.gte("payment_date", filters.from);
    if (filters.to) q = q.lte("payment_date", filters.to);
    if (filters.bankAccountId) q = q.eq("bank_account_id", filters.bankAccountId);
    if (filters.currency) q = q.eq("currency", filters.currency);
    if (filters.clientId) q = q.eq("client_id", filters.clientId);
    const { data, error } = await q.order("payment_date", { ascending: false }).limit(1000);
    return { data: (data ?? []) as unknown[], error };
  };
  const fetchPagos = async () => {
    if (!wantPagos) return { data: [] as unknown[], error: null };
    let q = supabase.from("supplier_payments").select(`${FX_COLUMNS}, expense_id, expenses(description), suppliers(name)`);
    if (filters.from) q = q.gte("payment_date", filters.from);
    if (filters.to) q = q.lte("payment_date", filters.to);
    if (filters.bankAccountId) q = q.eq("bank_account_id", filters.bankAccountId);
    if (filters.currency) q = q.eq("currency", filters.currency);
    if (filters.supplierId) q = q.eq("supplier_id", filters.supplierId);
    const { data, error } = await q.order("payment_date", { ascending: false }).limit(1000);
    return { data: (data ?? []) as unknown[], error };
  };
  const [cobros, pagos] = await Promise.all([fetchCobros(), fetchPagos()]);
  if (cobros.error) throw new Error(cobros.error.message);
  if (pagos.error) throw new Error(pagos.error.message);

  const one = <T,>(v: unknown): T | null => (Array.isArray(v) ? (v[0] ?? null) : ((v as T) ?? null));
  type Row = RawFxPayment & Record<string, unknown>;
  const rows: PaymentFxRow[] = [
    ...((cobros.data ?? []) as unknown as Row[]).map((p) =>
      toPaymentFxRow(p, "COBRO", {
        documentLabel: `Factura ${one<{ number: string }>(p.invoices)?.number ?? ""}`.trim(),
        documentHref: p.invoice_id ? `/invoices/${p.invoice_id as string}` : null,
        party: one<{ name: string }>(p.clients)?.name ?? "—",
        accountName: one<{ name: string }>(p.bank_accounts)?.name ?? "—",
      }, functional),
    ),
    ...((pagos.data ?? []) as unknown as Row[]).map((p) =>
      toPaymentFxRow(p, "PAGO", {
        documentLabel: one<{ description: string }>(p.expenses)?.description ?? "Gasto",
        documentHref: p.expense_id ? `/expenses/${p.expense_id as string}` : null,
        party: one<{ name: string }>(p.suppliers)?.name ?? "—",
        accountName: one<{ name: string }>(p.bank_accounts)?.name ?? "—",
      }, functional),
    ),
  ]
    .filter((r) => !filters.onlyForeign || r.foreign)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return { rows, summary: summarizePaymentsByCurrency(rows), functionalCurrency: functional };
}
