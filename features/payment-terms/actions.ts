"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { paymentTermSchema } from "./schema";

export type ActionState = { error: string | null };

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

export async function createPaymentTermAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("settings.manage");

  const parsed = paymentTermSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    credit_days: String(formData.get("credit_days") ?? "0"),
    payment_method: String(formData.get("payment_method") ?? "TRANSFER"),
    advance_percent: String(formData.get("advance_percent") ?? "100"),
    balance_percent: String(formData.get("balance_percent") ?? "0"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("payment_terms")
    .insert({ company_id: companyId, ...parsed.data })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "Ya existe una condición de pago con ese nombre." };
    return { error: error.message };
  }

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "payment_term",
    entityId: data.id,
    newValues: parsed.data,
  });

  revalidatePath("/settings/payment-terms");
  return { error: null };
}

export async function togglePaymentTermActiveAction(id: string, currentlyActive: boolean): Promise<void> {
  await requirePermission("settings.manage");
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("payment_terms")
    .update({ is_active: !currentlyActive })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: currentlyActive ? "DEACTIVATE" : "ACTIVATE",
    entityType: "payment_term",
    entityId: id,
    newValues: { is_active: !currentlyActive },
  });

  revalidatePath("/settings/payment-terms");
}

export async function deletePaymentTermAction(id: string): Promise<void> {
  await requirePermission("settings.manage");
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("payment_terms").delete().eq("id", id);
  if (error) throw new Error(error.message);

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "DELETE",
    entityType: "payment_term",
    entityId: id,
  });

  revalidatePath("/settings/payment-terms");
}
