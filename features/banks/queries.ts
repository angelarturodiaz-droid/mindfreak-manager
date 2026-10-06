import { createClient } from "@/lib/supabase/server";

export async function listBankAccountsWithBalance() {
  const supabase = await createClient();
  const { data: accounts, error } = await supabase
    .from("bank_accounts")
    .select("id, name, bank_name, account_number_masked, currency, is_active, type, credit_limit, account_kind, allow_overdraft, favor_increases_limit")
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
      "id, type, amount, exchange_rate, transaction_date, description, reference, reconciled, system_concept, related_source_type, related_source_id, project_id, client_id, supplier_id, category_id, expense_categories(name), customer_payment_id, supplier_payment_id, expense_id, transfer_group_id, counterpart_account_id, counterpart:bank_accounts!bank_transactions_counterpart_account_id_fkey(name), customer_payments(invoice_id, invoices(number)), expenses(description), supplier_payments(expense_id, expenses(description))",
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

  // Saldo actual de cada cuenta, para avisar en el formulario de
  // transferencia cuándo un pago a tarjeta deja saldo a favor.
  const { data: balances, error: balError } = await supabase
    .from("bank_account_balances")
    .select("bank_account_id, current_balance");
  if (balError) throw new Error(balError.message);
  const balanceMap = new Map((balances ?? []).map((b) => [b.bank_account_id, Number(b.current_balance)]));
  return data.map((a) => ({ ...a, current_balance: balanceMap.get(a.id) ?? 0 }));
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

/** Lo necesario para mostrar "cuánto hay disponible" al elegir una cuenta en un pago. */
export type AccountFunds = {
  currency: string;
  type: string;
  account_kind: string | null;
  allow_overdraft: boolean;
  credit_limit: number | null;
  favor_increases_limit: boolean;
  /** Saldo actual (tarjetas: negativo = deuda, positivo = saldo a favor). */
  balance: number;
};

/**
 * Saldo de cada cuenta activa, por id — solo para mostrarlo en los
 * formularios de pago. Si el usuario no puede leer los saldos, devuelve {}
 * y el formulario simplemente no muestra el dato.
 */
export async function getAccountFunds(): Promise<Record<string, AccountFunds>> {
  try {
    const supabase = await createClient();
    const [{ data: accounts, error }, { data: balances, error: balError }] = await Promise.all([
      supabase
        .from("bank_accounts")
        .select("id, currency, type, account_kind, allow_overdraft, credit_limit, favor_increases_limit")
        .eq("is_active", true),
      supabase.from("bank_account_balances").select("bank_account_id, current_balance"),
    ]);
    if (error || balError || !accounts) return {};
    const balanceMap = new Map((balances ?? []).map((b) => [b.bank_account_id, Number(b.current_balance)]));
    return Object.fromEntries(
      accounts.map((a) => [
        a.id,
        {
          currency: a.currency,
          type: a.type,
          account_kind: a.account_kind ?? null,
          allow_overdraft: Boolean(a.allow_overdraft),
          credit_limit: a.credit_limit == null ? null : Number(a.credit_limit),
          favor_increases_limit: Boolean(a.favor_increases_limit),
          balance: balanceMap.get(a.id) ?? 0,
        },
      ]),
    );
  } catch {
    return {};
  }
}
