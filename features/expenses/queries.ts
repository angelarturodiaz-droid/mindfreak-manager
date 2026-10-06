import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, pageRange } from "@/lib/utils/pagination";

export type ExpenseListFilters = {
  status?: string;
  /** "review": tratamiento fiscal por revisar · "withheld": con retenciones. */
  fiscal?: string;
  page?: number;
};

/** Estados fiscales que cuentan como "por revisar" (ver features/fiscal/expense-labels.ts). */
const FISCAL_REVIEW = ["MISSING_DATA", "NO_RULE", "REVIEW"];

/** Lista paginada de gastos (PAGE_SIZE por página) con el total para la paginación. */
export async function listExpenses(filters: ExpenseListFilters = {}) {
  const supabase = await createClient();
  const [from, to] = pageRange(filters.page ?? 1);
  let query = supabase
    .from("expenses")
    .select(
      "id, expense_date, description, subtotal, tax, total, balance, status, currency, fiscal_status, total_withheld, expense_categories(name), suppliers(name), projects(number, name)",
      { count: "exact" },
    )
    .order("expense_date", { ascending: false })
    .range(from, to);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.fiscal === "review") query = query.in("fiscal_status", FISCAL_REVIEW).neq("status", "CANCELLED");
  if (filters.fiscal === "withheld") query = query.gt("total_withheld", 0);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: data, total: count ?? 0, pageSize: PAGE_SIZE };
}

/**
 * Resumen para el encabezado de /expenses (solo lectura), en moneda base:
 * conteo por estado, saldo por pagar y lo gastado en el mes y el año en
 * curso (sin cancelados).
 */
export async function getExpenseStats() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("status, total, balance, exchange_rate, expense_date, fiscal_status, total_withheld");
  if (error) throw new Error(error.message);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(
    new Date(),
  );
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const byStatus: Record<string, number> = {};
  let porPagar = 0;
  let porPagarCount = 0;
  let mes = 0;
  let anio = 0;
  let fiscalReview = 0;
  let withheldCount = 0;
  for (const e of data ?? []) {
    byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    if (Number(e.total_withheld ?? 0) > 0) withheldCount += 1;
    if (e.status !== "CANCELLED" && FISCAL_REVIEW.includes(e.fiscal_status)) fiscalReview += 1;
    if (e.status === "CANCELLED") continue;
    const rate = Number(e.exchange_rate ?? 1);
    if (e.status === "PENDING" || e.status === "PARTIALLY_PAID") {
      porPagar += Number(e.balance) * rate;
      porPagarCount += 1;
    }
    if (e.expense_date?.startsWith(month)) mes += Number(e.total) * rate;
    if (e.expense_date?.startsWith(year)) anio += Number(e.total) * rate;
  }
  return { total: (data ?? []).length, byStatus, porPagar, porPagarCount, mes, anio, fiscalReview, withheldCount };
}

export async function getExpense(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select(
      "*, expense_categories(name), suppliers(name), projects(number, name), bank_accounts(name, bank_name)",
    )
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listExpenseCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .select("id, name")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listActiveSuppliers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    // category_id / service_type_id: para sugerir la categoría y el tipo de
    // servicio del gasto al elegir el proveedor (tratamiento fiscal).
    .select("id, name, category_id, service_type_id")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listProjectsForSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, number, name")
    .neq("status", "CANCELLED")
    .order("number", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listCreditCardsForSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("id, name, bank_name, credit_limit")
    .eq("is_active", true)
    .eq("type", "CREDIT_CARD")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listActiveAccountsForSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("id, name, bank_name, type, currency")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}
