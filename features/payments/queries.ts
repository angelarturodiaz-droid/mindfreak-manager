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
    .select("id, payment_date, amount, method, reference, notes, bank_accounts(name, bank_name)")
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
