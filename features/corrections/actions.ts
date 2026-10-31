"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { correctionErrorMessage, type CorrectionAction, type CorrectionTargetType } from "./schema";

export type CorrectionResult = { ok: boolean; message: string };

function linkPath(linkType: string | null, linkId: string | null): string | null {
  if (!linkType || !linkId) return null;
  if (linkType === "invoice") return `/invoices/${linkId}`;
  if (linkType === "expense") return `/expenses/${linkId}`;
  if (linkType === "bank_account") return `/banks/${linkId}`;
  return null;
}

async function revalidateFor(requestId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_correction_requests")
    .select("link_type, link_id")
    .eq("id", requestId)
    .maybeSingle();
  const path = linkPath(data?.link_type ?? null, data?.link_id ?? null);
  if (path) revalidatePath(path);
  revalidatePath("/payments");
  revalidatePath("/banks", "layout");
  revalidatePath("/invoices");
  revalidatePath("/expenses");
  revalidatePath("/projects", "layout");
}

/** Pedir una corrección o anulación (no cambia nada hasta que otra persona la apruebe). */
export async function requestCorrectionAction(input: {
  targetType: CorrectionTargetType;
  targetId: string;
  action: CorrectionAction;
  changes: { amount?: number | null; date?: string | null; bank_account_id?: string | null; reference?: string | null; description?: string | null };
  reason: string;
}): Promise<CorrectionResult> {
  if (!(await hasPermission("payments.create"))) {
    return { ok: false, message: "No tienes permiso para pedir correcciones." };
  }
  const supabase = await createClient();
  const newValues: Record<string, unknown> = {};
  if (input.action === "CHANGE") {
    const c = input.changes;
    if (c.amount !== undefined && c.amount !== null) newValues.amount = c.amount;
    if (c.date) newValues.date = c.date;
    if (c.bank_account_id) newValues.bank_account_id = c.bank_account_id;
    if (c.reference !== undefined && c.reference !== null) newValues.reference = c.reference;
    if (c.description) newValues.description = c.description;
  }
  const { data, error } = await supabase.rpc("request_payment_correction", {
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_action: input.action,
    p_new: newValues,
    p_reason: input.reason,
  });
  if (error) return { ok: false, message: correctionErrorMessage(error.message) };
  await revalidateFor(data as string);
  return {
    ok: true,
    message:
      "Listo: la solicitud quedó enviada y avisamos a Administración y Finanzas. Todavía no cambió nada; cuando la aprueben se aplica sola y te llega un aviso en la campanita.",
  };
}

export async function approveCorrectionAction(requestId: string, note: string): Promise<CorrectionResult> {
  if (!(await hasPermission("payments.void"))) {
    return { ok: false, message: "Solo Administración o Finanzas pueden aprobar correcciones." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_payment_correction", { p_request_id: requestId, p_note: note || null });
  if (error) return { ok: false, message: correctionErrorMessage(error.message) };
  await revalidateFor(requestId);
  return {
    ok: true,
    message: "Corrección aplicada. El registro, el documento y el banco quedaron ajustados, y le avisamos a quien la pidió.",
  };
}

export async function rejectCorrectionAction(requestId: string, note: string): Promise<CorrectionResult> {
  if (!(await hasPermission("payments.void"))) {
    return { ok: false, message: "Solo Administración o Finanzas pueden rechazar correcciones." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_payment_correction", { p_request_id: requestId, p_note: note });
  if (error) return { ok: false, message: correctionErrorMessage(error.message) };
  await revalidateFor(requestId);
  return { ok: true, message: "Solicitud rechazada. No cambió nada y le avisamos a quien la pidió con tu nota." };
}

export async function withdrawCorrectionAction(requestId: string): Promise<CorrectionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_payment_correction", { p_request_id: requestId });
  if (error) return { ok: false, message: correctionErrorMessage(error.message) };
  await revalidateFor(requestId);
  return { ok: true, message: "Solicitud retirada. No cambió nada." };
}
