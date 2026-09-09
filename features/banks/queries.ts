import { createClient } from "@/lib/supabase/server";

export async function listBankAccountsWithBalance() {
  const supabase = await createClient();
  const { data: accounts, error } = await supabase
    .from("bank_accounts")
    .select("id, name, bank_name, currency, is_active")
    .order("name");
  if (error) throw new Error(error.message);
  if (!accounts || accounts.length === 0) return [];

  const { data: balances, error: balError } = await supabase
    .from("bank_account_balances")
    .select("bank_account_id, current_balance");
  if (balError) throw new Error(balError.message);

  const balanceMap = new Map((balances ?? []).map((b) => [b.bank_account_id, b.current_balance]));
  return accounts.map((a) => ({ ...a, current_balance: balanceMap.get(a.id) ?? 0 }));
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
      "id, type, amount, transaction_date, description, reconciled, project_id, client_id, supplier_id",
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
    .select("id, name, bank_name, currency")
    .eq("is_active", true)
    .neq("id", excludeId)
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}
