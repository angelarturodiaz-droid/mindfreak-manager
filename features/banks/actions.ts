"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { bankAccountSchema, manualTransactionSchema, transferSchema } from "./schema";

export type ActionState = { error: string | null };

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

export async function createBankAccountAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("banks.create");

  const parsed = bankAccountSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    bank_name: String(formData.get("bank_name") ?? ""),
    account_number_masked: String(formData.get("account_number_masked") ?? ""),
    currency: String(formData.get("currency") ?? "DOP"),
    opening_balance: String(formData.get("opening_balance") ?? "0"),
    opening_balance_date: String(formData.get("opening_balance_date") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({
      company_id: companyId,
      name: parsed.data.name,
      bank_name: parsed.data.bank_name || null,
      account_number_masked: parsed.data.account_number_masked || null,
      currency: parsed.data.currency,
      opening_balance: parsed.data.opening_balance,
      opening_balance_date: parsed.data.opening_balance_date,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "bank_account",
    entityId: data.id,
    newValues: parsed.data,
  });

  revalidatePath("/banks");
  redirect(`/banks/${data.id}`);
}

export async function toggleBankAccountActiveAction(
  accountId: string,
  currentlyActive: boolean,
): Promise<void> {
  await requirePermission("banks.create");
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("bank_accounts")
    .update({ is_active: !currentlyActive })
    .eq("id", accountId);
  if (error) throw new Error(error.message);

  revalidatePath("/banks");
  revalidatePath(`/banks/${accountId}`);
}

/**
 * Movimiento manual (INCOME/EXPENSE) no ligado a un cobro/gasto — ej.
 * intereses, comisiones bancarias, depósito inicial adicional. Los
 * movimientos por cobros/pagos se generan automáticamente desde
 * register_customer_payment/register_supplier_payment (F11/F13).
 */
export async function createManualTransactionAction(
  bankAccountId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("banks.create");

  const parsed = manualTransactionSchema.safeParse({
    type: String(formData.get("type") ?? "INCOME"),
    transaction_date: String(formData.get("transaction_date") ?? ""),
    amount: String(formData.get("amount") ?? "0"),
    description: String(formData.get("description") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();

  const { data: account, error: accError } = await supabase
    .from("bank_accounts")
    .select("currency")
    .eq("id", bankAccountId)
    .single();
  if (accError || !account) return { error: "Cuenta no encontrada." };

  const { error } = await supabase.from("bank_transactions").insert({
    company_id: companyId,
    bank_account_id: bankAccountId,
    type: parsed.data.type,
    amount: parsed.data.amount,
    currency: account.currency,
    exchange_rate: 1,
    transaction_date: parsed.data.transaction_date,
    description: parsed.data.description,
  });
  if (error) return { error: error.message };

  revalidatePath(`/banks/${bankAccountId}`);
  revalidatePath("/banks");
  return { error: null };
}

/**
 * Transferencia entre dos cuentas propias. Toda la lógica (dos filas,
 * atómico) vive en la función Postgres `create_bank_transfer` — ver
 * F0-Arquitectura sección H.
 */
export async function createTransferAction(
  fromAccountId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("banks.create");

  const parsed = transferSchema.safeParse({
    to_bank_account_id: String(formData.get("to_bank_account_id") ?? ""),
    transaction_date: String(formData.get("transaction_date") ?? ""),
    amount: String(formData.get("amount") ?? "0"),
    description: String(formData.get("description") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();

  const { error } = await supabase.rpc("create_bank_transfer", {
    p_company_id: companyId,
    p_from_account_id: fromAccountId,
    p_to_account_id: parsed.data.to_bank_account_id,
    p_amount: parsed.data.amount,
    p_transaction_date: parsed.data.transaction_date,
    p_description: parsed.data.description || null,
  });

  if (error) {
    if (error.message.includes("invalid_accounts")) {
      return { error: "La cuenta origen y destino no pueden ser la misma." };
    }
    return { error: error.message };
  }

  revalidatePath(`/banks/${fromAccountId}`);
  revalidatePath(`/banks/${parsed.data.to_bank_account_id}`);
  revalidatePath("/banks");
  return { error: null };
}

export async function toggleReconciledAction(
  transactionId: string,
  bankAccountId: string,
  currentlyReconciled: boolean,
): Promise<void> {
  await requirePermission("banks.reconcile");
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("bank_transactions")
    .update({ reconciled: !currentlyReconciled })
    .eq("id", transactionId);
  if (error) throw new Error(error.message);

  revalidatePath(`/banks/${bankAccountId}`);
}
