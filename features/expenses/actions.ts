"use server";

import { currencyError } from "@/features/currencies/queries";
import { foreignPaymentError, foreignPaymentRpcParams, parseForeignPayment } from "@/features/payments/schema";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { expenseSchema, calculateExpenseTotals } from "./schema";
import { bankRuleState, overdraftConfirmed, type MoneyActionState } from "@/lib/utils/bank-errors";
import { safeReturnTo } from "@/lib/utils/return-to";
import {
  evaluateExpenseFiscal,
  fiscalColumns,
  type ExpenseFiscalInput,
  type ExpenseFiscalPreview,
} from "@/features/fiscal/expense-fiscal";

/** confirmOverdraft: ver features/banks/actions.ts (sobregiro por confirmar). */
export type ActionState = MoneyActionState;

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

function parseExpenseForm(formData: FormData) {
  return expenseSchema.safeParse({
    category_id: String(formData.get("category_id") ?? ""),
    supplier_id: String(formData.get("supplier_id") ?? ""),
    project_id: String(formData.get("project_id") ?? ""),
    bank_account_id: String(formData.get("bank_account_id") ?? ""),
    expense_date: String(formData.get("expense_date") ?? ""),
    description: String(formData.get("description") ?? ""),
    subtotal: String(formData.get("subtotal") ?? "0"),
    tax_percent: String(formData.get("tax_percent") ?? "0"),
    payment_method: String(formData.get("payment_method") ?? ""),
    currency: String(formData.get("currency") ?? "DOP"),
    exchange_rate: String(formData.get("exchange_rate") ?? "1"),
    payee_bank_name: String(formData.get("payee_bank_name") ?? ""),
    service_type_id: String(formData.get("service_type_id") ?? ""),
    document_type: String(formData.get("document_type") ?? ""),
    ncf: String(formData.get("ncf") ?? ""),
  });
}

type ParsedExpense = NonNullable<ReturnType<typeof parseExpenseForm>["data"]>;

function fiscalInputFrom(data: ParsedExpense, tax: number, total: number): ExpenseFiscalInput {
  return {
    supplierId: data.supplier_id || null,
    serviceTypeId: data.service_type_id || null,
    documentType: data.document_type || null,
    ncf: data.ncf || null,
    date: data.expense_date,
    subtotal: data.subtotal,
    tax,
    total,
  };
}

/**
 * Calcula el tratamiento fiscal en el servidor (nunca se confía en lo que
 * muestra el navegador). Si una regla BLOQUEA la combinación, el gasto no
 * se guarda. Sin regla o con datos faltantes se guarda con retención 0 y
 * queda "por revisar".
 */
async function resolveFiscal(data: ParsedExpense, tax: number, total: number) {
  const input = fiscalInputFrom(data, tax, total);
  const res = await evaluateExpenseFiscal(input);
  if (res.status === "BLOCKED") {
    return { ok: false as const, error: `No se puede registrar este gasto: ${res.message}` };
  }
  return { ok: true as const, columns: fiscalColumns(input, res), res };
}

/**
 * Vista previa de la tarjeta "Tratamiento fiscal" del formulario de gasto.
 * Solo calcula y explica; no guarda nada.
 */
export async function previewExpenseFiscalAction(input: {
  supplierId: string;
  serviceTypeId: string;
  documentType: string;
  date: string;
  subtotal: number;
  taxPercent: number;
}): Promise<ExpenseFiscalPreview> {
  await requirePermission("expenses.create");
  const { tax, total } = calculateExpenseTotals({
    subtotal: Math.max(0, Number(input.subtotal) || 0),
    tax_percent: Math.max(0, Number(input.taxPercent) || 0),
  });
  return evaluateExpenseFiscal({
    supplierId: input.supplierId || null,
    serviceTypeId: input.serviceTypeId || null,
    documentType: input.documentType || null,
    ncf: null,
    date: input.date || new Date().toISOString().slice(0, 10),
    subtotal: Math.max(0, Number(input.subtotal) || 0),
    tax,
    total,
  });
}

export async function createExpenseAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("expenses.create");

  const parsed = parseExpenseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }  const currencyProblem = await currencyError(parsed.data.currency, null);
  if (currencyProblem) return { error: currencyProblem };


  const { tax, total } = calculateExpenseTotals(parsed.data);
  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();

  if (parsed.data.payment_method === "CARD" && !parsed.data.bank_account_id) {
    return { error: "Selecciona con qué tarjeta se pagó este gasto." };
  }

  const fiscal = await resolveFiscal(parsed.data, tax, total);
  if (!fiscal.ok) return { error: fiscal.error };
  const fiscalAudit = {
    fiscal_status: fiscal.columns.fiscal_status,
    fiscal_rule: fiscal.res.rule ? `${fiscal.res.rule.rule_key} v${fiscal.res.rule.version}` : null,
    total_withheld: fiscal.columns.total_withheld,
    net_payable: fiscal.columns.net_payable,
  };

  // Si se indica una cuenta (banco o tarjeta), el gasto se crea YA PAGADO
  // y genera su movimiento contra esa cuenta en el mismo momento — evita
  // el paso de "Registrar pago" cuando el usuario ya sabe desde dónde se
  // pagó. Sin cuenta, sigue naciendo pendiente como siempre.
  if (parsed.data.bank_account_id) {
    // Multimoneda V5: cuenta en otra moneda → datos del bloque "Pago en
    // moneda diferente" (la base de datos recalcula y valida todo).
    const fx = parseForeignPayment(formData);
    if (!fx.success) return { error: fx.error.issues[0]?.message ?? "Datos del pago en otra moneda inválidos." };
    const { data, error } = await supabase.rpc("create_card_expense", {
      p_company_id: companyId,
      p_category_id: parsed.data.category_id || null,
      p_supplier_id: parsed.data.supplier_id || null,
      p_project_id: parsed.data.project_id || null,
      p_card_account_id: parsed.data.bank_account_id,
      p_expense_date: parsed.data.expense_date,
      p_description: parsed.data.description,
      p_subtotal: parsed.data.subtotal,
      p_tax: tax,
      p_total: total,
      p_currency: parsed.data.currency,
      p_exchange_rate: parsed.data.exchange_rate,
      p_payment_method: parsed.data.payment_method || "TRANSFER",
      p_payee_bank_name: parsed.data.payee_bank_name || null,
      p_confirm_overdraft: overdraftConfirmed(formData),
      p_fiscal: { ...fiscal.columns, snapshot: fiscal.columns.fiscal_snapshot },
      ...foreignPaymentRpcParams(fx.data),
    });
    // Fondos insuficientes, crédito insuficiente o sobregiro por confirmar (migración 063)
    if (error) {
      const fxError = foreignPaymentError(error.message);
      return bankRuleState(error.message) ?? { error: fxError ?? error.message };
    }

    await logAudit({
      companyId,
      action: "CREATE",
      entityType: "expense",
      entityId: data as string,
      newValues: { ...parsed.data, tax, total, ...fiscalAudit, paidImmediately: true },
    });

    revalidatePath("/expenses");
    revalidatePath("/banks");
    // Creado desde un proyecto o proveedor: vuelve ahí (ver return_to).
    const returnTo = safeReturnTo(String(formData.get("return_to") ?? ""));
    if (returnTo) revalidatePath(returnTo.split("?")[0]);
    redirect(returnTo ?? `/expenses/${data}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      company_id: companyId,
      category_id: parsed.data.category_id || null,
      supplier_id: parsed.data.supplier_id || null,
      project_id: parsed.data.project_id || null,
      expense_date: parsed.data.expense_date,
      description: parsed.data.description,
      subtotal: parsed.data.subtotal,
      tax,
      total,
      // Con retenciones, lo que se le debe al proveedor es el neto.
      balance: fiscal.columns.net_payable,
      payment_method: parsed.data.payment_method || null,
      currency: parsed.data.currency,
      exchange_rate: parsed.data.exchange_rate,
      status: "PENDING",
      payee_bank_name: parsed.data.payee_bank_name || null,
      created_by: user?.id,
      ...fiscal.columns,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "expense",
    entityId: data.id,
    newValues: { ...parsed.data, tax, total, ...fiscalAudit },
  });

  revalidatePath("/expenses");
  const returnTo = safeReturnTo(String(formData.get("return_to") ?? ""));
  if (returnTo) revalidatePath(returnTo.split("?")[0]);
  redirect(returnTo ?? `/expenses/${data.id}`);
}

export async function updateExpenseAction(
  expenseId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("expenses.create");

  const parsed = parseExpenseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createSupabaseClient();

  // Solo se puede editar mientras está PENDING y sin pagos registrados aún
  // (una vez tiene un pago parcial, se trata como actividad financiera real
  // y ya no se edita libremente — mismo principio que cotizaciones/facturas).
  const { data: existing, error: fetchError } = await supabase
    .from("expenses")
    .select("status, paid_amount, currency")
    .eq("id", expenseId)
    .single();
  if (fetchError || !existing) return { error: "Gasto no encontrado." };
  if (existing.status !== "PENDING" || existing.paid_amount > 0) {
    return { error: "Este gasto ya no se puede editar (tiene pagos registrados)." };
  }
  const currencyProblem = await currencyError(parsed.data.currency, existing.currency);
  if (currencyProblem) return { error: currencyProblem };

  const { tax, total } = calculateExpenseTotals(parsed.data);

  // Editar el gasto vuelve a calcular el tratamiento fiscal con las reglas
  // vigentes (y deja sin efecto un ajuste manual anterior).
  const fiscal = await resolveFiscal(parsed.data, tax, total);
  if (!fiscal.ok) return { error: fiscal.error };

  const { error } = await supabase
    .from("expenses")
    .update({
      category_id: parsed.data.category_id || null,
      supplier_id: parsed.data.supplier_id || null,
      project_id: parsed.data.project_id || null,
      bank_account_id: parsed.data.bank_account_id || null,
      expense_date: parsed.data.expense_date,
      description: parsed.data.description,
      subtotal: parsed.data.subtotal,
      tax,
      total,
      balance: fiscal.columns.net_payable,
      payment_method: parsed.data.payment_method || null,
      currency: parsed.data.currency,
      exchange_rate: parsed.data.exchange_rate,
      payee_bank_name: parsed.data.payee_bank_name || null,
      ...fiscal.columns,
      fiscal_override_reason: null,
      fiscal_overridden_by: null,
      fiscal_overridden_at: null,
    })
    .eq("id", expenseId);

  if (error) return { error: error.message };

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "expense",
    entityId: expenseId,
    newValues: {
      ...parsed.data,
      tax,
      total,
      fiscal_status: fiscal.columns.fiscal_status,
      total_withheld: fiscal.columns.total_withheld,
      net_payable: fiscal.columns.net_payable,
    },
  });

  revalidatePath(`/expenses/${expenseId}`);
  return { error: null };
}

/**
 * "Recalcular" el tratamiento fiscal con las reglas y datos de hoy (por ej.
 * después de completar la ficha del proveedor o clasificar el tipo de
 * servicio). Solo mientras el gasto esté pendiente y sin pagos: una vez
 * pagado, lo retenido ya salió así y no se toca.
 */
export async function recalculateExpenseFiscalAction(expenseId: string): Promise<{ error: string | null; message?: string }> {
  await requirePermission("expenses.create");
  const supabase = await createSupabaseClient();
  const { data: e, error: fetchError } = await supabase
    .from("expenses")
    .select(
      "status, paid_amount, supplier_id, service_type_id, document_type, ncf, expense_date, subtotal, tax, total, fiscal_status, total_withheld, net_payable",
    )
    .eq("id", expenseId)
    .single();
  if (fetchError || !e) return { error: "Gasto no encontrado." };
  if (e.status !== "PENDING" || Number(e.paid_amount) > 0) {
    return { error: "Solo se puede recalcular un gasto pendiente y sin pagos." };
  }

  const input: ExpenseFiscalInput = {
    supplierId: e.supplier_id,
    serviceTypeId: e.service_type_id,
    documentType: e.document_type,
    ncf: e.ncf,
    date: e.expense_date,
    subtotal: Number(e.subtotal),
    tax: Number(e.tax),
    total: Number(e.total),
  };
  const res = await evaluateExpenseFiscal(input);
  if (res.status === "BLOCKED") return { error: `La regla vigente bloquea este gasto: ${res.message}` };
  const columns = fiscalColumns(input, res);

  const { error } = await supabase
    .from("expenses")
    .update({
      ...columns,
      balance: columns.net_payable,
      fiscal_override_reason: null,
      fiscal_overridden_by: null,
      fiscal_overridden_at: null,
    })
    .eq("id", expenseId);
  if (error) return { error: error.message };

  await logAudit({
    companyId: await getPrimaryCompanyId(),
    action: "FISCAL_RECALCULATE",
    entityType: "expense",
    entityId: expenseId,
    oldValues: { fiscal_status: e.fiscal_status, total_withheld: e.total_withheld, net_payable: e.net_payable },
    newValues: {
      fiscal_status: columns.fiscal_status,
      fiscal_rule: res.rule ? `${res.rule.rule_key} v${res.rule.version}` : null,
      total_withheld: columns.total_withheld,
      net_payable: columns.net_payable,
    },
  });
  revalidatePath(`/expenses/${expenseId}`);
  revalidatePath("/expenses");
  return { error: null, message: res.message };
}

/**
 * Ajuste manual del tratamiento fiscal (fase 7): para los casos que las
 * reglas no cubren o que el contador indica distinto. Solo quien puede
 * aprobar gastos (expenses.approve), con motivo obligatorio y solo mientras
 * el gasto esté pendiente y sin pagos. Queda en la auditoría
 * (FISCAL_OVERRIDE) con los montos de antes y de después.
 */
export async function overrideExpenseFiscalAction(
  expenseId: string,
  input: { isrWithheld: number; itbisWithheld: number; reason: string },
): Promise<{ error: string | null }> {
  await requirePermission("expenses.approve");
  const reason = String(input.reason ?? "").trim();
  if (reason.length < 10) return { error: "Escribe el motivo del ajuste (al menos 10 caracteres)." };
  const isr = Math.round(Number(input.isrWithheld) * 100) / 100;
  const itbis = Math.round(Number(input.itbisWithheld) * 100) / 100;
  if (!Number.isFinite(isr) || !Number.isFinite(itbis) || isr < 0 || itbis < 0) {
    return { error: "Los montos retenidos deben ser números positivos (o 0)." };
  }

  const supabase = await createSupabaseClient();
  const { data: e, error: fetchError } = await supabase
    .from("expenses")
    .select("status, paid_amount, total, tax, fiscal_status, isr_withheld, itbis_withheld, total_withheld, net_payable, fiscal_snapshot")
    .eq("id", expenseId)
    .single();
  if (fetchError || !e) return { error: "Gasto no encontrado." };
  if (e.status !== "PENDING" || Number(e.paid_amount) > 0) {
    return { error: "Solo se puede ajustar un gasto pendiente y sin pagos." };
  }
  if (itbis > Number(e.tax)) return { error: "El ITBIS retenido no puede ser mayor que el ITBIS de la factura." };
  const totalWithheld = Math.round((isr + itbis) * 100) / 100;
  if (totalWithheld > Number(e.total)) return { error: "Lo retenido no puede ser mayor que el total de la factura." };
  const net = Math.round((Number(e.total) - totalWithheld) * 100) / 100;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const before = {
    fiscal_status: e.fiscal_status,
    isr_withheld: Number(e.isr_withheld),
    itbis_withheld: Number(e.itbis_withheld),
    total_withheld: Number(e.total_withheld),
    net_payable: Number(e.net_payable ?? e.total),
  };
  const snapshot = (e.fiscal_snapshot as Record<string, unknown> | null) ?? {};
  const { error } = await supabase
    .from("expenses")
    .update({
      fiscal_status: "OVERRIDDEN",
      isr_withheld: isr,
      itbis_withheld: itbis,
      total_withheld: totalWithheld,
      net_payable: net,
      balance: net,
      fiscal_override_reason: reason,
      fiscal_overridden_by: user?.id ?? null,
      fiscal_overridden_at: new Date().toISOString(),
      fiscal_snapshot: {
        ...snapshot,
        override: { reason, before, at: new Date().toISOString() },
        message: "Tratamiento fiscal ajustado manualmente.",
      },
    })
    .eq("id", expenseId);
  if (error) return { error: error.message };

  await logAudit({
    companyId: await getPrimaryCompanyId(),
    action: "FISCAL_OVERRIDE",
    entityType: "expense",
    entityId: expenseId,
    oldValues: before,
    newValues: { fiscal_status: "OVERRIDDEN", isr_withheld: isr, itbis_withheld: itbis, total_withheld: totalWithheld, net_payable: net, reason },
  });
  revalidatePath(`/expenses/${expenseId}`);
  revalidatePath("/expenses");
  return { error: null };
}

/**
 * Cancela un gasto (soft-state). NUNCA se borra físicamente un gasto — es
 * una regla explícita de F0-Arquitectura, sección M ("nunca en... expenses").
 */
export async function cancelExpenseAction(expenseId: string): Promise<void> {
  await requirePermission("expenses.create");
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("expenses")
    .update({ status: "CANCELLED" })
    .eq("id", expenseId);
  if (error) throw new Error(error.message);

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "STATUS_CANCELLED",
    entityType: "expense",
    entityId: expenseId,
    newValues: { status: "CANCELLED" },
  });

  revalidatePath(`/expenses/${expenseId}`);
  revalidatePath("/expenses");
}
