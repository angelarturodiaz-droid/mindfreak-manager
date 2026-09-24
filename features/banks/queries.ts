import { createClient } from "@/lib/supabase/server";

export async function listBankAccountsWithBalance() {
  const supabase = await createClient();
  const { data: accounts, error } = await supabase
    .from("bank_accounts")
    .select("id, name, bank_name, account_number_masked, currency, is_active, type, credit_limit")
    .order("name");
  if (error) throw new Error(error.message);
  if (!accounts || accounts.length === 0) return [];

  const { data: balances, error: balError } = await supabase
    .from("bank_account_balances")
    .select("bank_account_id, current_balance");
  if (balError) throw new Error(balError.message);

  const balanceMap = new Map((balances ?? []).map((b) => [b.bank_account_id, b.current_balance]));

  // Movimientos "Sin categoría" por cuenta, para la alerta de clasificación.
  const { data: uncategorized, error: uncError } = await supabase
    .from("bank_transactions")
    .select("bank_account_id")
    .is("category_id", null);
  if (uncError) throw new Error(uncError.message);
  const uncMap = new Map<string, number>();
  for (const t of uncategorized ?? []) {
    uncMap.set(t.bank_account_id, (uncMap.get(t.bank_account_id) ?? 0) + 1);
  }

  return accounts.map((a) => ({
    ...a,
    current_balance: balanceMap.get(a.id) ?? 0,
    uncategorized_count: uncMap.get(a.id) ?? 0,
  }));
}

export async function getBankAccount(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);

  const { data: balance } = await supabase
    .from("bank_account_balances")
    .select("current_balance")
    .eq("bank_account_id", id)
    .single();

  return { ...data, current_balance: balance?.current_balance ?? data.opening_balance };
}

export async function listBankTransactions(bankAccountId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_transactions")
    .select(
      "id, type, amount, transaction_date, description, reference, reconciled, project_id, client_id, supplier_id, category_id, expense_categories(name), customer_payment_id, supplier_payment_id, expense_id, transfer_group_id, counterpart_account_id, counterpart:bank_accounts!bank_transactions_counterpart_account_id_fkey(name), customer_payments(invoice_id, invoices(number)), expenses(description), supplier_payments(expense_id, expenses(description))",
    )
    .eq("bank_account_id", bankAccountId)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listOtherActiveAccounts(excludeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("id, name, bank_name, currency, type")
    .eq("is_active", true)
    .neq("id", excludeId)
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function hasBankTransactions(accountId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("bank_transactions")
    .select("id", { count: "exact", head: true })
    .eq("bank_account_id", accountId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/**
 * Efecto real de un movimiento sobre el balance de la cuenta, igual que la
 * vista bank_account_balances: INCOME suma, EXPENSE resta (se guarda en
 * positivo), TRANSFER ya viene con signo. Solo para mostrarlo con + / −.
 */
export function transactionEffect(type: string, amount: number): number {
  if (type === "INCOME") return Number(amount);
  if (type === "EXPENSE") return -Number(amount);
  if (type === "TRANSFER") return Number(amount);
  return 0;
}
