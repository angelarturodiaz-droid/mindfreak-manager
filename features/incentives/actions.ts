"use server";

/**
 * V1-2 Incentivos por proyecto (decidido con el contador, 22-oct-2026).
 *
 * Un incentivo es un gasto del proyecto con categoría «Incentivo por proyecto»,
 * SIN proveedor, SIN ITBIS y SIN retenciones. Monto fijo o % de la «ganancia
 * antes de incentivos» (ventas sin ITBIS − gastos sin ITBIS, sin incentivos),
 * calculado SIEMPRE en el servidor. Solo Administrador y Finanzas
 * (permiso expenses.incentives, migración 088).
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { safeReturnTo } from "@/lib/utils/return-to";
import { bankRuleState, overdraftConfirmed, type MoneyActionState } from "@/lib/utils/bank-errors";
import { evaluateExpenseFiscal, fiscalColumns, type ExpenseFiscalInput } from "@/features/fiscal/expense-fiscal";
import { getProjectProfitability } from "@/features/projects/queries";
import { incentiveAmountFromPercent } from "@/features/profitability/net-of-tax";
import { catalogKeyOf, INCENTIVE_CATEGORY_NAME } from "./catalog";

const money = (n: number) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(n);

const incentiveSchema = z
  .object({
    project_id: z.string().uuid({ message: "Falta el proyecto." }),
    recipient: z
      .string()
      .trim()
      .min(2, { message: "Escribe el nombre de quien recibe el incentivo." })
      .max(120, { message: "El nombre es muy largo (máximo 120 letras)." }),
    recipient_type: z.enum(["EMPLOYEE", "THIRD_PARTY"], { message: "Indica si es empleado o tercero." }),
    reason: z
      .string()
      .trim()
      .min(3, { message: "Escribe el motivo (ej. coordinación del evento)." })
      .max(160, { message: "El motivo es muy largo (máximo 160 letras)." }),
    mode: z.enum(["FIXED", "PERCENT"], { message: "Elige cómo se calcula: monto fijo o %." }),
    amount: z.coerce.number().optional(),
    percent: z.coerce.number().optional(),
    expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Falta la fecha." }),
    payment_method: z.string().optional(),
    bank_account_id: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "FIXED" && !(Number(v.amount) > 0)) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Escribe el monto del incentivo (mayor que 0)." });
    }
    if (v.mode === "PERCENT" && !(Number(v.percent) > 0 && Number(v.percent) <= 100)) {
      ctx.addIssue({ code: "custom", path: ["percent"], message: "Escribe un % entre 0.01 y 100." });
    }
  });

function describe(recipient: string, type: "EMPLOYEE" | "THIRD_PARTY", reason: string, projectNumber: string) {
  return `Incentivo por proyecto – ${recipient} (${type === "EMPLOYEE" ? "empleado" : "tercero"}) – ${reason} – ${projectNumber}`;
}

async function incentiveCategoryId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("expense_categories").select("id, name");
  const key = catalogKeyOf(INCENTIVE_CATEGORY_NAME);
  return (data ?? []).find((c) => catalogKeyOf(c.name) === key)?.id ?? null;
}

export async function createIncentiveAction(_prev: MoneyActionState, formData: FormData): Promise<MoneyActionState> {
  await requirePermission("expenses.incentives");

  const parsed = incentiveSchema.safeParse({
    project_id: String(formData.get("project_id") ?? ""),
    recipient: String(formData.get("recipient") ?? ""),
    recipient_type: String(formData.get("recipient_type") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    mode: String(formData.get("mode") ?? ""),
    amount: formData.get("amount") ? String(formData.get("amount")) : undefined,
    percent: formData.get("percent") ? String(formData.get("percent")) : undefined,
    expense_date: String(formData.get("expense_date") ?? ""),
    payment_method: String(formData.get("payment_method") ?? ""),
    bank_account_id: String(formData.get("bank_account_id") ?? ""),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Revisa los datos del incentivo.", field: String(issue?.path?.[0] ?? "") };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, number, name, status")
    .eq("id", d.project_id)
    .single();
  if (projectError || !project) return { error: "Proyecto no encontrado." };
  if (project.status === "CANCELLED") return { error: "El proyecto está cancelado: no se le pueden agregar incentivos." };

  // Monto: fijo, o % de la ganancia antes de incentivos calculada aquí (nunca en el navegador).
  let amount = Math.round(Number(d.amount ?? 0) * 100) / 100;
  let base: number | null = null;
  if (d.mode === "PERCENT") {
    const p = await getProjectProfitability(d.project_id);
    base = Math.round(p.gananciaAntesIncentivos * 100) / 100;
    const calc = incentiveAmountFromPercent(Number(d.percent), base);
    if (calc === null || calc <= 0) {
      return {
        error: `No se puede calcular un % porque el proyecto todavía no tiene ganancia (ganancia antes de incentivos: ${money(base)}). Factura primero o usa un monto fijo.`,
        field: "percent",
      };
    }
    amount = calc;
  }

  const categoryId = await incentiveCategoryId(supabase);
  const companyIds = await getCurrentUserCompanyIds();
  const companyId = companyIds[0];
  if (!companyId) return { error: "Tu usuario no está asignado a ninguna compañía." };

  const description = describe(d.recipient, d.recipient_type, d.reason, project.number);
  // Sin proveedor: el motor fiscal no aplica retenciones (se paga el monto completo).
  const fiscalInput: ExpenseFiscalInput = {
    supplierId: null,
    serviceTypeId: null,
    documentType: null,
    ncf: null,
    date: d.expense_date,
    subtotal: amount,
    tax: 0,
    total: amount,
  };
  const fiscalRes = await evaluateExpenseFiscal(fiscalInput);
  const fiscal = fiscalColumns(fiscalInput, fiscalRes);

  const incentiveFields = {
    incentive_recipient: d.recipient,
    incentive_recipient_type: d.recipient_type,
    incentive_reason: d.reason,
    incentive_mode: d.mode,
    incentive_percent: d.mode === "PERCENT" ? Number(d.percent) : null,
    incentive_base: base,
    incentive_base_at: base !== null ? new Date().toISOString() : null,
  };

  let expenseId: string;
  if (d.bank_account_id) {
    // Pagado al crearlo: mismo camino que un gasto pagado al crearlo (en pesos).
    const { data: account } = await supabase.from("bank_accounts").select("currency").eq("id", d.bank_account_id).single();
    if (account && account.currency !== "DOP") {
      return {
        error: "El incentivo es en pesos: elige una cuenta en pesos, o déjalo pendiente y págalo desde el gasto (ahí se puede pagar desde otra moneda).",
        field: "bank_account_id",
      };
    }
    const { data, error } = await supabase.rpc("create_card_expense", {
      p_company_id: companyId,
      p_category_id: categoryId,
      p_supplier_id: null,
      p_project_id: d.project_id,
      p_card_account_id: d.bank_account_id,
      p_expense_date: d.expense_date,
      p_description: description,
      p_subtotal: amount,
      p_tax: 0,
      p_total: amount,
      p_currency: "DOP",
      p_exchange_rate: 1,
      p_payment_method: d.payment_method || "TRANSFER",
      p_payee_bank_name: null,
      p_confirm_overdraft: overdraftConfirmed(formData),
      p_fiscal: { ...fiscal, snapshot: fiscal.fiscal_snapshot },
    });
    if (error) return bankRuleState(error.message) ?? { error: error.message };
    expenseId = data as string;
    const { error: upError } = await supabase.from("expenses").update(incentiveFields).eq("id", expenseId);
    if (upError) return { error: `El pago se registró, pero no se pudieron guardar los datos del incentivo: ${upError.message}` };
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        company_id: companyId,
        category_id: categoryId,
        supplier_id: null,
        project_id: d.project_id,
        expense_date: d.expense_date,
        description,
        subtotal: amount,
        tax: 0,
        total: amount,
        balance: amount,
        payment_method: d.payment_method || null,
        currency: "DOP",
        exchange_rate: 1,
        status: "PENDING",
        created_by: user?.id,
        ...fiscal,
        ...incentiveFields,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    expenseId = data.id;
  }

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "expense",
    entityId: expenseId,
    newValues: { incentive: true, project: project.number, description, amount, ...incentiveFields, paidImmediately: Boolean(d.bank_account_id) },
  });

  revalidatePath(`/projects/${d.project_id}`);
  revalidatePath("/expenses");
  if (d.bank_account_id) revalidatePath("/banks");
  const returnTo = safeReturnTo(String(formData.get("return_to") ?? ""));
  redirect(returnTo ?? `/projects/${d.project_id}?tab=finanzas`);
}

/**
 * Recalcular un incentivo por % con la ganancia de hoy. Solo si está
 * pendiente y sin pagos (lo pagado ya no se toca).
 */
export async function recalculateIncentiveAction(expenseId: string): Promise<{ error: string | null; message?: string }> {
  await requirePermission("expenses.incentives");
  const supabase = await createClient();
  const { data: e, error } = await supabase
    .from("expenses")
    .select("id, company_id, project_id, status, paid_amount, total, expense_date, incentive_mode, incentive_percent, incentive_base")
    .eq("id", expenseId)
    .single();
  if (error || !e) return { error: "Incentivo no encontrado." };
  if (e.incentive_mode !== "PERCENT" || !e.project_id) return { error: "Solo se recalculan los incentivos por %." };
  if (e.status !== "PENDING" || Number(e.paid_amount) > 0) {
    return { error: "Este incentivo ya tiene pagos: no se puede recalcular." };
  }
  const p = await getProjectProfitability(e.project_id);
  const base = Math.round(p.gananciaAntesIncentivos * 100) / 100;
  const amount = incentiveAmountFromPercent(Number(e.incentive_percent), base);
  if (amount === null || amount <= 0) {
    return { error: `La ganancia antes de incentivos hoy es ${money(base)}: no alcanza para calcular el %.` };
  }
  const fiscalInput: ExpenseFiscalInput = {
    supplierId: null,
    serviceTypeId: null,
    documentType: null,
    ncf: null,
    date: e.expense_date,
    subtotal: amount,
    tax: 0,
    total: amount,
  };
  const fiscal = fiscalColumns(fiscalInput, await evaluateExpenseFiscal(fiscalInput));
  const { error: upError } = await supabase
    .from("expenses")
    .update({
      subtotal: amount,
      tax: 0,
      total: amount,
      balance: amount,
      ...fiscal,
      incentive_base: base,
      incentive_base_at: new Date().toISOString(),
    })
    .eq("id", expenseId);
  if (upError) return { error: upError.message };

  await logAudit({
    companyId: e.company_id,
    action: "UPDATE",
    entityType: "expense",
    entityId: expenseId,
    oldValues: { total: e.total, incentive_base: e.incentive_base },
    newValues: { total: amount, incentive_base: base, recalculated: true },
  });
  revalidatePath(`/projects/${e.project_id}`);
  revalidatePath(`/expenses/${expenseId}`);
  return { error: null, message: `Incentivo recalculado: ${Number(e.incentive_percent)} % de ${money(base)} = ${money(amount)}.` };
}
