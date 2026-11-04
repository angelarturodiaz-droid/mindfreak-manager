"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserCompanyIds, hasPermission } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { ASSET_STATUSES, assetErrorMessage, type AssetStatus } from "./schema";

export type AssetState = { error: string | null; success?: string; successId?: number; errorId?: number; field?: string };

async function companyId(): Promise<string> {
  const ids = await getCurrentUserCompanyIds();
  if (!ids.length) throw new Error("Tu usuario no está asignado a ninguna compañía.");
  return ids[0];
}

function fail(error: string, field?: string): AssetState {
  return { error, field, errorId: Date.now() };
}

/** Lee y valida el formulario del activo (nuevo o editar). */
function readForm(formData: FormData): { values: Record<string, unknown> } | { error: AssetState } {
  const description = String(formData.get("description") ?? "").trim();
  if (description.length < 2) return { error: fail("Escribe qué es (ej. «Mesa plegable blanca»).", "description") };
  const quantity = Number(String(formData.get("quantity") ?? "1").replace(/,/g, ""));
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: fail("La cantidad debe ser mayor que cero.", "quantity") };
  const rawValue = String(formData.get("value") ?? "").replace(/[,\s]/g, "").replace(/^(RD|US)?\$/i, "");
  const value = rawValue === "" ? null : Number(rawValue);
  if (value !== null && (!Number.isFinite(value) || value < 0)) return { error: fail("El valor debe ser un número (ej. 2,135.00).", "value") };
  const status = String(formData.get("status") ?? "EN_USO");
  if (!(ASSET_STATUSES as readonly string[]).includes(status)) return { error: fail("Estado no válido.") };
  const purchaseDate = String(formData.get("purchase_date") ?? "").trim();
  return {
    values: {
      description,
      detail: String(formData.get("detail") ?? "").trim() || null,
      type_id: String(formData.get("type_id") ?? "") || null,
      quantity,
      responsible_name: String(formData.get("responsible_name") ?? "").trim() || null,
      location_id: String(formData.get("location_id") ?? "") || null,
      value,
      currency: formData.get("currency") === "USD" ? "USD" : "DOP",
      purchase_date: purchaseDate || null,
      status: status as AssetStatus,
      is_consumable: formData.get("is_consumable") === "on" || formData.get("is_consumable") === "true",
    },
  };
}

export async function createAssetAction(_prev: AssetState, formData: FormData): Promise<AssetState> {
  if (!(await hasPermission("assets.manage"))) return fail("No tienes permiso para registrar activos.");
  const parsed = readForm(formData);
  if ("error" in parsed) return parsed.error;
  const supabase = await createClient();
  const cid = await companyId();
  const expenseId = String(formData.get("expense_id") ?? "") || null;
  const { data, error } = await supabase
    .from("assets")
    .insert({ ...parsed.values, company_id: cid, expense_id: expenseId })
    .select("id, code")
    .single();
  if (error || !data) return fail(assetErrorMessage(error?.message ?? "No se pudo guardar."));
  await logAudit({ companyId: cid, action: "CREATE", entityType: "asset", entityId: data.id, newValues: { code: data.code, ...parsed.values, expense_id: expenseId } });
  revalidatePath("/assets");
  if (expenseId) revalidatePath(`/expenses/${expenseId}`);
  redirect(`/assets/${data.id}?nuevo=1`);
}

export async function updateAssetAction(assetId: string, _prev: AssetState, formData: FormData): Promise<AssetState> {
  if (!(await hasPermission("assets.manage"))) return fail("No tienes permiso para editar activos.");
  const parsed = readForm(formData);
  if ("error" in parsed) return parsed.error;
  const supabase = await createClient();
  const cid = await companyId();
  const { data: before } = await supabase
    .from("assets")
    .select("description, detail, type_id, quantity, responsible_name, location_id, value, currency, purchase_date, status, is_consumable")
    .eq("id", assetId)
    .maybeSingle();
  const { error } = await supabase.from("assets").update(parsed.values).eq("id", assetId);
  if (error) return fail(assetErrorMessage(error.message));
  await logAudit({ companyId: cid, action: "UPDATE", entityType: "asset", entityId: assetId, oldValues: before ?? null, newValues: parsed.values });
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  return { error: null, success: "Activo guardado.", successId: Date.now() };
}


/** Portada (foto que sale en la lista). */
export async function setAssetCoverAction(assetId: string, documentId: string): Promise<void> {
  if (!(await hasPermission("assets.manage"))) throw new Error("No tienes permiso.");
  const supabase = await createClient();
  const { error } = await supabase.from("assets").update({ cover_document_id: documentId }).eq("id", assetId);
  if (error) throw new Error(assetErrorMessage(error.message));
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/assets");
}

/** Anular un activo registrado por error: motivo obligatorio, se suelta del gasto, nada se borra. */
export async function voidAssetAction(assetId: string, reason: string): Promise<AssetState> {
  if (!(await hasPermission("assets.manage"))) return fail("No tienes permiso para anular activos.");
  const text = reason.trim();
  if (text.length < 10) return fail("Escribe el motivo de la anulación (mínimo 10 letras).", "reason");
  const supabase = await createClient();
  const cid = await companyId();
  const { data: before } = await supabase.from("assets").select("code, status, expense_id").eq("id", assetId).maybeSingle();
  const { error } = await supabase.rpc("void_asset", { p_asset_id: assetId, p_reason: text });
  if (error) return fail(assetErrorMessage(error.message));
  await logAudit({
    companyId: cid,
    action: "VOID",
    entityType: "asset",
    entityId: assetId,
    oldValues: before ?? null,
    newValues: { status: "ANULADO", void_reason: text, expense_id: null },
  });
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  if (before?.expense_id) revalidatePath(`/expenses/${before.expense_id}`);
  return { error: null, success: `Activo ${before?.code ?? ""} anulado. Ya no sale en la lista y se soltó del gasto.`, successId: Date.now() };
}
