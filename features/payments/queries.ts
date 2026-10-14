import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, pageRange } from "@/lib/utils/pagination";
import { idsByName, searchOr } from "@/lib/utils/search";

export async function listPaymentsForInvoice(invoiceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_payments")
    .select(
      "id, payment_date, created_at, amount, withholding_total, amount_applied, method, reference, notes, account_currency, account_amount, bank_fee_amount, effective_rate, effective_rate_currency, reference_rate, reference_rate_document, rate_manual_override, rounding_difference, informative_difference, functional_currency, bank_accounts(name, bank_name), customer_payment_withholdings(id, withholding_type, amount, currency, certificate_amount, certificate_currency, certificate_number, withholding_date, notes, status, voided_at, void_reason, documents(id, file_name, storage_path))",
    )
    .eq("invoice_id", invoiceId)
    .order("payment_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listAllPayments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_payments")
    .select(
      "id, invoice_id, payment_date, created_at, amount, withholding_total, method, invoices(number), clients(name), bank_accounts(name, bank_name)",
    )
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Cobros de clientes paginados (PAGE_SIZE), del más reciente al más antiguo.
 * Busca por referencia o por nombre del cliente.
 */
export async function listCustomerPaymentsPage(filters: { search?: string; page?: number } = {}) {
  const supabase = await createClient();
  const [from, to] = pageRange(filters.page ?? 1);
  let query = supabase
    .from("customer_payments")
    .select(
      "id, invoice_id, payment_date, created_at, amount, withholding_total, method, invoices(number), clients(name), bank_accounts(name, bank_name)",
      { count: "exact" },
    )
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (filters.search) {
    const ids = await idsByName(supabase, "clients", filters.search);
    query = query.or(searchOr(filters.search, ["reference"], { column: "client_id", ids }));
  }
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0, pageSize: PAGE_SIZE };
}

/**
 * Pagos a proveedores paginados (PAGE_SIZE), del más reciente al más
 * antiguo. Busca por referencia o por nombre del proveedor.
 */
export async function listSupplierPaymentsPage(filters: { search?: string; page?: number } = {}) {
  const supabase = await createClient();
  const [from, to] = pageRange(filters.page ?? 1);
  let query = supabase
    .from("supplier_payments")
    .select(
      "id, expense_id, payment_date, created_at, amount, method, expenses(description), suppliers(name), bank_accounts(name, bank_name)",
      { count: "exact" },
    )
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (filters.search) {
    const ids = await idsByName(supabase, "suppliers", filters.search);
    query = query.or(searchOr(filters.search, ["reference"], { column: "supplier_id", ids }));
  }
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0, pageSize: PAGE_SIZE };
}

/** Cantidad total de cobros y de pagos (para las pestañas). */
export async function countPaymentsByKind() {
  const supabase = await createClient();
  const [c, s] = await Promise.all([
    supabase.from("customer_payments").select("id", { count: "exact", head: true }),
    supabase.from("supplier_payments").select("id", { count: "exact", head: true }),
  ]);
  return { cobros: c.count ?? 0, pagos: s.count ?? 0 };
}

export async function listBankAccounts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("id, name, bank_name, currency")
    .eq("is_active", true)
    .eq("type", "BANK")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listPaymentsForExpense(expenseId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_payments")
    .select(
      "id, payment_date, created_at, amount, method, reference, notes, payee_bank_name, account_currency, account_amount, bank_fee_amount, effective_rate, effective_rate_currency, reference_rate, reference_rate_document, rate_manual_override, rounding_difference, informative_difference, functional_currency, bank_accounts(name, bank_name)",
    )
    .eq("expense_id", expenseId)
    .order("payment_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listAllSupplierPayments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_payments")
    .select(
      "id, expense_id, payment_date, created_at, amount, method, expenses(description), suppliers(name), bank_accounts(name, bank_name)",
    )
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Resumen para el encabezado de /payments (solo lectura), en moneda base:
 * cobrado y pagado a proveedores en el mes en curso, y cobrado en el año.
 */
export async function getPaymentStats() {
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(
    new Date(),
  );
  const monthStart = `${today.slice(0, 7)}-01`;
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const [customer, supplier] = await Promise.all([
    supabase
      .from("customer_payments")
      .select("amount, exchange_rate, payment_date")
      .gte("payment_date", yearStart),
    supabase
      .from("supplier_payments")
      .select("amount, exchange_rate, payment_date")
      .gte("payment_date", monthStart),
  ]);
  if (customer.error) throw new Error(customer.error.message);
  if (supplier.error) throw new Error(supplier.error.message);

  const base = (r: { amount: number; exchange_rate: number | null }) =>
    Number(r.amount) * Number(r.exchange_rate ?? 1);
  let cobradoMes = 0;
  let cobradoMesCount = 0;
  let cobradoAnio = 0;
  for (const r of customer.data ?? []) {
    cobradoAnio += base(r);
    if (r.payment_date >= monthStart) {
      cobradoMes += base(r);
      cobradoMesCount += 1;
    }
  }
  const pagadoMes = (supplier.data ?? []).reduce((acc, r) => acc + base(r), 0);
  return {
    cobradoMes,
    cobradoMesCount,
    pagadoMes,
    pagadoMesCount: (supplier.data ?? []).length,
    netoMes: cobradoMes - pagadoMes,
    cobradoAnio,
  };
}
