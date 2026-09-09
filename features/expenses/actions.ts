"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { expenseSchema, calculateExpenseTotals } from "./schema";

export type ActionState = { error: string | null };

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
  }

  const { tax, total } = calculateExpenseTotals(parsed.data);
  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
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
      bank_account_id: parsed.data.bank_account_id || null,
      expense_date: parsed.data.expense_date,
      description: parsed.data.description,
      subtotal: parsed.data.subtotal,
      tax,
      total,
      balance: total,
      payment_method: parsed.data.payment_method || null,
      currency: parsed.data.currency,
      exchange_rate: parsed.data.exchange_rate,
      status: "PENDING",
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "expense",
    entityId: data.id,
    newValues: parsed.data,
  });

  revalidatePath("/expenses");
  redirect(`/expenses/${data.id}`);
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
    .select("status, paid_amount")
    .eq("id", expenseId)
    .single();
  if (fetchError || !existing) return { error: "Gasto no encontrado." };
  if (existing.status !== "PENDING" || existing.paid_amount > 0) {
    return { error: "Este gasto ya no se puede editar (tiene pagos registrados)." };
  }

  const { tax, total } = calculateExpenseTotals(parsed.data);

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
      balance: total,
      payment_method: parsed.data.payment_method || null,
      currency: parsed.data.currency,
      exchange_rate: parsed.data.exchange_rate,
    })
    .eq("id", expenseId);

  if (error) return { error: error.message };

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "expense",
    entityId: expenseId,
    newValues: parsed.data,
  });

  revalidatePath(`/expenses/${expenseId}`);
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
