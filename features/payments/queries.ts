import { createClient } from "@/lib/supabase/server";

export async function listPaymentsForInvoice(invoiceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_payments")
    .select("id, payment_date, amount, method, reference, notes, bank_accounts(name, bank_name)")
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
      "id, invoice_id, payment_date, amount, method, invoices(number), clients(name), bank_accounts(name, bank_name)",
    )
    .order("payment_date", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data;
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
      "id, payment_date, amount, method, reference, notes, payee_bank_name, bank_accounts(name, bank_name)",
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
      "id, expense_id, payment_date, amount, method, expenses(description), suppliers(name), bank_accounts(name, bank_name)",
    )
    .order("payment_date", { ascending: false })
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
