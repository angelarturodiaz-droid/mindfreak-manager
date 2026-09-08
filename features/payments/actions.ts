"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { registerPaymentSchema } from "./schema";

export type ActionState = { error: string | null };

/**
 * Registrar un cobro. Toda la lógica multi-tabla (factura, banco, auditoría)
 * vive en la función Postgres `register_customer_payment` (transaccional,
 * ver F0-Arquitectura sección H). Este Server Action solo valida el form y
 * la llama — no reimplementa los pasos en JS para no romper la atomicidad.
 */
export async function registerPaymentAction(
  invoiceId: string,
  clientId: string,
  projectId: string | null,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("payments.create"); // capa de aplicación; la función RPC también lo exige

  const parsed = registerPaymentSchema.safeParse({
    bank_account_id: String(formData.get("bank_account_id") ?? ""),
    payment_date: String(formData.get("payment_date") ?? ""),
    amount: String(formData.get("amount") ?? "0"),
    method: String(formData.get("method") ?? "TRANSFER"),
    reference: String(formData.get("reference") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    return { error: "Tu usuario no está asignado a ninguna compañía." };
  }

  const supabase = await createSupabaseClient();
  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select("currency, exchange_rate")
    .eq("id", invoiceId)
    .single();
  if (invError || !invoice) return { error: "Factura no encontrada." };

  const { error } = await supabase.rpc("register_customer_payment", {
    p_company_id: companyIds[0],
    p_client_id: clientId,
    p_invoice_id: invoiceId,
    p_project_id: projectId,
    p_bank_account_id: parsed.data.bank_account_id || null,
    p_payment_date: parsed.data.payment_date,
    p_amount: parsed.data.amount,
    p_method: parsed.data.method,
    p_reference: parsed.data.reference || null,
    p_currency: invoice.currency,
    p_exchange_rate: invoice.exchange_rate,
    p_notes: parsed.data.notes || null,
  });

  if (error) {
    // Traducir los errores conocidos de la función a mensajes claros
    if (error.message.includes("amount_exceeds_balance")) {
      return { error: "El monto supera el balance pendiente de la factura." };
    }
    if (error.message.includes("invalid_status")) {
      return { error: "Esta factura no admite cobros en su estado actual." };
    }
    return { error: error.message };
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/payments");
  return { error: null };
}
