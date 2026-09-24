"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { bankAccountSchema, bankAccountEditSchema, manualTransactionSchema, transferSchema } from "./schema";

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
    type: String(formData.get("type") ?? "BANK"),
    opening_balance: String(formData.get("opening_balance") ?? "0"),
    opening_balance_date: String(formData.get("opening_balance_date") ?? ""),
    credit_limit: formData.get("credit_limit") ? String(formData.get("credit_limit")) : undefined,
    account_kind: formData.get("account_kind") ? String(formData.get("account_kind")) : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();

  // Para una tarjeta, la "deuda inicial" que se escribe en el formulario
  // (positiva) se guarda como opening_balance NEGATIVO — así toda la
  // fórmula de balance/deuda es la misma que para un banco normal, sin
  // casos especiales (ver migración 036_credit_cards.sql).
  const openingBalance =
    parsed.data.type === "CREDIT_CARD"
      ? -Math.abs(parsed.data.opening_balance)
      : parsed.data.opening_balance;

  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({
      company_id: companyId,
      name: parsed.data.name,
      bank_name: parsed.data.bank_name || null,
      account_number_masked: parsed.data.account_number_masked || null,
      currency: parsed.data.currency,
      type: parsed.data.type,
      opening_balance: openingBalance,
      opening_balance_date: parsed.data.opening_balance_date,
      credit_limit: parsed.data.type === "CREDIT_CARD" ? parsed.data.credit_limit ?? null : null,
      account_kind: parsed.data.type === "BANK" ? parsed.data.account_kind ?? null : null,
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

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: currentlyActive ? "DEACTIVATE" : "ACTIVATE",
    entityType: "bank_account",
    entityId: accountId,
    newValues: { is_active: !currentlyActive },
  });

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
    category_id: String(formData.get("category_id") ?? ""),
    description: String(formData.get("description") ?? ""),
    reference: String(formData.get("reference") ?? ""),
    exchange_rate: formData.get("exchange_rate") ? String(formData.get("exchange_rate")) : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();

  let categoryName: string | null = null;
  if (parsed.data.category_id) {
    const { data: category } = await supabase
      .from("expense_categories")
      .select("name")
      .eq("id", parsed.data.category_id)
      .eq("company_id", companyId)
      .single();
    if (!category) return { error: "La categoría elegida no existe." };
    categoryName = category.name;
  }

  const { data: account, error: accError } = await supabase
    .from("bank_accounts")
    .select("currency")
    .eq("id", bankAccountId)
    .single();
  if (accError || !account) return { error: "Cuenta no encontrada." };

  // Cuenta en otra moneda (ej. USD): se pide la tasa para que los reportes
  // conviertan el movimiento a la moneda base. En moneda base es 1.
  const { data: company } = await supabase
    .from("companies")
    .select("base_currency")
    .eq("id", companyId)
    .single();
  const isForeign = Boolean(company && account.currency !== company.base_currency);
  if (isForeign && !parsed.data.exchange_rate) {
    return {
      error: `Esta cuenta está en ${account.currency}: indica la tasa (${company?.base_currency} por 1 ${account.currency}).`,
    };
  }
  const exchangeRate = isForeign ? parsed.data.exchange_rate! : 1;

  const { data: inserted, error } = await supabase
    .from("bank_transactions")
    .insert({
      company_id: companyId,
      bank_account_id: bankAccountId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      currency: account.currency,
      exchange_rate: exchangeRate,
      transaction_date: parsed.data.transaction_date,
      description: parsed.data.description || categoryName,
      category_id: parsed.data.category_id || null,
      reference: parsed.data.reference || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "bank_transaction",
    entityId: inserted.id,
    newValues: parsed.data,
  });

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
    exchange_rate: formData.get("exchange_rate") ? String(formData.get("exchange_rate")) : undefined,
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
    p_exchange_rate: parsed.data.exchange_rate ?? null,
  });

  if (error) {
    if (error.message.includes("invalid_accounts")) {
      return { error: "La cuenta origen y destino no pueden ser la misma." };
    }
    if (error.message.includes("exchange_rate_required")) {
      return { error: "Las cuentas tienen monedas distintas: indica la tasa de cambio." };
    }
    if (error.message.includes("unsupported_currencies")) {
      return { error: "Una de las dos cuentas debe estar en la moneda base de la empresa." };
    }
    return { error: error.message };
  }

  revalidatePath(`/banks/${fromAccountId}`);
  revalidatePath(`/banks/${parsed.data.to_bank_account_id}`);
  revalidatePath("/banks");
  return { error: null };
}

/**
 * Asigna o cambia la categoría de un movimiento (manual o automático:
 * cobros, pagos a proveedores, gastos). Solo cambia la categoría, nunca el
 * monto, la fecha ni la cuenta.
 */
export async function setTransactionCategoryAction(
  transactionId: string,
  bankAccountId: string,
  categoryId: string | null,
): Promise<void> {
  await requirePermission("banks.create");
  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();

  if (categoryId) {
    const { data: category } = await supabase
      .from("expense_categories")
      .select("id")
      .eq("id", categoryId)
      .eq("company_id", companyId)
      .single();
    if (!category) throw new Error("La categoría elegida no existe.");
  }

  const { error } = await supabase
    .from("bank_transactions")
    .update({ category_id: categoryId })
    .eq("id", transactionId)
    .eq("bank_account_id", bankAccountId);
  if (error) throw new Error(error.message);

  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "bank_transaction",
    entityId: transactionId,
    newValues: { category_id: categoryId },
  });

  revalidatePath(`/banks/${bankAccountId}`);
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

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: currentlyReconciled ? "UNRECONCILE" : "RECONCILE",
    entityType: "bank_transaction",
    entityId: transactionId,
    newValues: { reconciled: !currentlyReconciled },
  });

  revalidatePath(`/banks/${bankAccountId}`);
}

export async function updateBankAccountAction(
  accountId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("banks.create");

  const parsed = bankAccountEditSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    bank_name: String(formData.get("bank_name") ?? ""),
    account_number_masked: String(formData.get("account_number_masked") ?? ""),
    credit_limit: formData.get("credit_limit") ? String(formData.get("credit_limit")) : undefined,
    opening_balance: formData.get("opening_balance")
      ? String(formData.get("opening_balance"))
      : undefined,
    opening_balance_date: String(formData.get("opening_balance_date") ?? ""),
    account_kind: formData.get("account_kind") ? String(formData.get("account_kind")) : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();

  const { data: existing, error: fetchError } = await supabase
    .from("bank_accounts")
    .select("type")
    .eq("id", accountId)
    .single();
  if (fetchError) return { error: fetchError.message };

  // El balance/deuda inicial y su fecha solo se pueden tocar si la cuenta
  // todavía no tiene ningún movimiento — cambiarlos después desincronizaría
  // todo lo ya calculado (mismo criterio que "editable solo en borrador" ya
  // usado en Cotizaciones/Gastos).
  const { count: txCount, error: countError } = await supabase
    .from("bank_transactions")
    .select("id", { count: "exact", head: true })
    .eq("bank_account_id", accountId);
  if (countError) return { error: countError.message };

  const canEditOpeningBalance = (txCount ?? 0) === 0;

  const updatePayload: Record<string, unknown> = {
    name: parsed.data.name,
    bank_name: parsed.data.bank_name || null,
    account_number_masked: parsed.data.account_number_masked || null,
    credit_limit: parsed.data.credit_limit ?? null,
  };
  if (existing.type === "BANK") {
    updatePayload.account_kind = parsed.data.account_kind ?? null;
  }

  if (canEditOpeningBalance) {
    if (parsed.data.opening_balance !== undefined) {
      // Igual que al crear: para una tarjeta, la deuda se escribe positiva
      // pero se guarda como opening_balance negativo (ver 036_credit_cards.sql).
      updatePayload.opening_balance =
        existing.type === "CREDIT_CARD"
          ? -Math.abs(parsed.data.opening_balance)
          : parsed.data.opening_balance;
    }
    if (parsed.data.opening_balance_date) {
      updatePayload.opening_balance_date = parsed.data.opening_balance_date;
    }
  }

  const { error } = await supabase
    .from("bank_accounts")
    .update(updatePayload)
    .eq("id", accountId);
  if (error) return { error: error.message };

  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "bank_account",
    entityId: accountId,
    newValues: updatePayload,
  });

  revalidatePath(`/banks/${accountId}`);
  revalidatePath("/banks");
  return { error: null };
}
