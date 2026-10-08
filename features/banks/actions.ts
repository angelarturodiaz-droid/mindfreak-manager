"use server";

import { currencyError } from "@/features/currencies/queries";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { bankAccountSchema, bankAccountEditSchema, manualTransactionSchema, transferSchema } from "./schema";
import { bankRuleState, overdraftConfirmed, type MoneyActionState } from "@/lib/utils/bank-errors";
import { formatMoney } from "@/lib/utils/money";

/**
 * confirmOverdraft: la operación dejaría una cuenta corriente con
 * sobregiro autorizado en negativo; la pantalla muestra el mensaje y, si el
 * usuario pulsa Continuar, reenvía el formulario con confirm_overdraft=1.
 */
export type ActionState = MoneyActionState;

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
    allow_overdraft: formData.get("allow_overdraft") === "on",
    favor_increases_limit: formData.get("favor_increases_limit") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }  const currencyProblem = await currencyError(parsed.data.currency, null);
  if (currencyProblem) return { error: currencyProblem };

  if (parsed.data.type === "BANK" && !parsed.data.account_kind) {
    return { error: "Elige el tipo de cuenta: Ahorros o Corriente." };
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
      // Sobregiro: solo cuentas corrientes (las de ahorro nunca). Saldo a
      // favor sobre el límite: solo tarjetas. Ver migración 063.
      allow_overdraft:
        parsed.data.type === "BANK" && parsed.data.account_kind === "CHECKING" && parsed.data.allow_overdraft,
      favor_increases_limit: parsed.data.type === "CREDIT_CARD" && parsed.data.favor_increases_limit,
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

  // Multimoneda V5 (paso 4): comisión cobrada después y relacionada con un
  // pago, cobro o transferencia de ESTA cuenta ("tipo:id", opcional).
  const related = parseFeeLink(String(formData.get("related") ?? ""));
  const type = String(formData.get("type") ?? "INCOME");
  if (related === "invalid") return { error: "La operación relacionada no es válida. Recarga la página." };
  if (related && type !== "EXPENSE") {
    return { error: "Solo un gasto (comisión) se puede relacionar con un pago, cobro o transferencia." };
  }
  let categoryInput = String(formData.get("category_id") ?? "");
  if (related) {
    const supabaseCheck = await createSupabaseClient();
    const column = FEE_LINK_COLUMN[related.type];
    const { data: own } = await supabaseCheck
      .from("bank_transactions")
      .select("id")
      .eq("bank_account_id", bankAccountId)
      .eq(column, related.id)
      .limit(1);
    if (!own || own.length === 0) {
      return { error: "La operación relacionada no es de esta cuenta. Elige una de la lista." };
    }
    // Sin categoría elegida: Comisiones bancarias.
    if (!categoryInput) {
      const { data: cat } = await supabaseCheck
        .from("expense_categories")
        .select("id")
        .ilike("name", "comisiones bancarias")
        .limit(1);
      categoryInput = cat?.[0]?.id ?? "";
    }
  }

  const parsed = manualTransactionSchema.safeParse({
    type,
    transaction_date: String(formData.get("transaction_date") ?? ""),
    amount: String(formData.get("amount") ?? "0"),
    category_id: categoryInput,
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
      overdraft_confirmed: overdraftConfirmed(formData),
      ...(related
        ? { system_concept: "BANK_FEE", related_source_type: related.type, related_source_id: related.id }
        : {}),
    })
    .select("id")
    .single();
  if (error) return bankRuleState(error.message) ?? { error: error.message };

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "bank_transaction",
    entityId: inserted.id,
    newValues: related ? { ...parsed.data, related_source_type: related.type, related_source_id: related.id } : parsed.data,
  });

  revalidatePath(`/banks/${bankAccountId}`);
  revalidatePath("/banks");
  return {
    error: null,
    success: `${parsed.data.type === "INCOME" ? "Ingreso" : "Gasto"} de ${formatMoney(parsed.data.amount, account.currency)} registrado.`,
    successId: Date.now(),
  };
}

const FEE_LINK_COLUMN = {
  customer_payment: "customer_payment_id",
  supplier_payment: "supplier_payment_id",
  bank_transfer: "transfer_group_id",
} as const;
type FeeLinkType = keyof typeof FEE_LINK_COLUMN;

/** "tipo:uuid" del selector "Comisión de…" → objeto, null (vacío) o "invalid". */
function parseFeeLink(value: string): { type: FeeLinkType; id: string } | null | "invalid" {
  if (!value) return null;
  const [type, id] = value.split(":");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!(type in FEE_LINK_COLUMN) || !uuid.test(id ?? "")) return "invalid";
  return { type: type as FeeLinkType, id };
}

/** Campo numérico opcional del formulario: vacío = no se envía. */
const optNum = (v: FormDataEntryValue | null) => (v && String(v).trim() !== "" ? String(v) : undefined);

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
    exchange_rate: optNum(formData.get("exchange_rate")),
    to_amount: optNum(formData.get("to_amount")),
    fee: optNum(formData.get("fee")),
    reference_rate: optNum(formData.get("reference_rate")),
    reference_rate_source: String(formData.get("reference_rate_source") ?? "") || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const msg = issue?.message ?? "Datos inválidos.";
    // Falta lo que entró en la cuenta destino: ventana roja + campo en rojo.
    if (issue?.path[0] === "to_amount") return { error: msg, blockedTitle: "Falta un dato", blocked: msg, field: "fx" };
    return { error: msg };
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
    p_confirm_overdraft: overdraftConfirmed(formData),
    p_to_amount: parsed.data.to_amount ?? null,
    p_fee: parsed.data.fee || null,
    p_reference_rate: parsed.data.reference_rate ?? null,
    p_reference_rate_source: parsed.data.reference_rate_source ?? null,
  });

  if (error) {
    const rule = bankRuleState(error.message);
    if (rule) return rule;
    if (error.message.includes("invalid_accounts")) {
      return { error: "La cuenta origen y destino no pueden ser la misma." };
    }
    if (error.message.includes("exchange_rate_required")) {
      const msg =
        "Falta cuánto entró en la cuenta destino. Esta transferencia es entre cuentas de monedas distintas: escribe el monto que realmente recibió la otra cuenta (lo que dice su estado de cuenta).";
      return { error: msg, blockedTitle: "Falta un dato", blocked: msg, field: "fx" };
    }
    if (error.message.includes("invalid_amount")) {
      const i = error.message.indexOf("invalid_amount:");
      return { error: error.message.slice(i + 15).trim() };
    }
    if (error.message.includes("unsupported_currencies")) {
      return {
        error:
          "No se puede transferir directamente entre dos monedas extranjeras. Una de las dos cuentas tiene que estar en pesos (la moneda base de la empresa).",
      };
    }
    return { error: error.message };
  }

  revalidatePath(`/banks/${fromAccountId}`);
  revalidatePath(`/banks/${parsed.data.to_bank_account_id}`);
  revalidatePath("/banks");

  const { data: pair } = await supabase
    .from("bank_accounts")
    .select("id, name, currency")
    .in("id", [fromAccountId, parsed.data.to_bank_account_id]);
  const from = pair?.find((a) => a.id === fromAccountId);
  const to = pair?.find((a) => a.id === parsed.data.to_bank_account_id);
  const fromCur = from?.currency ?? "DOP";
  const received =
    from && to && from.currency !== to.currency && parsed.data.to_amount
      ? ` (entraron ${formatMoney(parsed.data.to_amount, to.currency)})`
      : "";
  const fee = parsed.data.fee ? ` La comisión de ${formatMoney(parsed.data.fee, fromCur)} quedó registrada aparte.` : "";
  return {
    error: null,
    successTitle: "Transferencia realizada",
    success: `Se transfirieron ${formatMoney(parsed.data.amount, fromCur)}${
      from && to ? ` de ${from.name} a ${to.name}` : ""
    }${received}. Los saldos de las dos cuentas ya están actualizados.${fee}`,
    successId: Date.now(),
  };
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
    allow_overdraft: formData.get("allow_overdraft") === "on",
    favor_increases_limit: formData.get("favor_increases_limit") === "on",
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
    // Sobregiro solo en cuenta corriente; al pasarla a ahorro se apaga.
    updatePayload.allow_overdraft = parsed.data.account_kind === "CHECKING" && parsed.data.allow_overdraft;
  } else {
    updatePayload.favor_increases_limit = parsed.data.favor_increases_limit;
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
