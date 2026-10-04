"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";

/**
 * Clasificaciones fiscales (migración 071) y su asignación a los tipos de
 * servicio. Solo Configuración (settings.manage). Todo queda en Auditoría.
 */

export type ClassificationState = { error: string | null; success?: string; successId?: number };

async function companyId(): Promise<string> {
  const ids = await getCurrentUserCompanyIds();
  if (ids.length === 0) throw new Error("Tu usuario no está asignado a ninguna compañía.");
  return ids[0];
}

function revalidate() {
  revalidatePath("/settings/service-types");
}

function codeFromName(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "CLASIFICACION"
  );
}

export async function createFiscalClassificationAction(
  _prev: ClassificationState,
  formData: FormData,
): Promise<ClassificationState> {
  await requirePermission("settings.manage");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (name.length < 2) return { error: "Escribe el nombre de la clasificación." };

  const cid = await companyId();
  const supabase = await createClient();
  let code = codeFromName(name);
  const { data: existing } = await supabase.from("fiscal_classifications").select("code").eq("company_id", cid);
  const codes = new Set((existing ?? []).map((c) => c.code));
  for (let i = 2; codes.has(code); i++) code = `${codeFromName(name).slice(0, 36)}_${i}`;

  const { data, error } = await supabase
    .from("fiscal_classifications")
    .insert({ company_id: cid, code, name, description: description || null, position: 85 })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: `Ya existe una clasificación llamada "${name}".` };
    return { error: error.message };
  }
  await logAudit({ companyId: cid, action: "CREATE", entityType: "fiscal_classification", entityId: data.id, newValues: { name, code } });
  revalidate();
  return { error: null, success: `Clasificación "${name}" creada.`, successId: Date.now() };
}

export async function updateFiscalClassificationAction(
  id: string,
  _prev: ClassificationState,
  formData: FormData,
): Promise<ClassificationState> {
  await requirePermission("settings.manage");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (name.length < 2) return { error: "Escribe el nombre de la clasificación." };
  const supabase = await createClient();
  const { data: old } = await supabase.from("fiscal_classifications").select("name, description").eq("id", id).single();
  const { error } = await supabase
    .from("fiscal_classifications")
    .update({ name, description: description || null })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: `Ya existe una clasificación llamada "${name}".` };
    return { error: error.message };
  }
  await logAudit({
    companyId: await companyId(),
    action: "UPDATE",
    entityType: "fiscal_classification",
    entityId: id,
    oldValues: old ?? null,
    newValues: { name, description },
  });
  revalidate();
  return { error: null, success: "Clasificación guardada.", successId: Date.now() };
}

export async function toggleFiscalClassificationAction(id: string): Promise<void> {
  await requirePermission("settings.manage");
  const supabase = await createClient();
  const { data: c } = await supabase.from("fiscal_classifications").select("is_active").eq("id", id).single();
  if (!c) throw new Error("No se encontró la clasificación.");
  const { error } = await supabase.from("fiscal_classifications").update({ is_active: !c.is_active }).eq("id", id);
  if (error) throw new Error(error.message);
  await logAudit({
    companyId: await companyId(),
    action: c.is_active ? "DEACTIVATE" : "ACTIVATE",
    entityType: "fiscal_classification",
    entityId: id,
  });
  revalidate();
}

/** Asigna (o quita, con null) la clasificación fiscal de un tipo de servicio. */
export async function setServiceTypeClassificationAction(
  serviceTypeId: string,
  classificationId: string | null,
): Promise<void> {
  await requirePermission("settings.manage");
  const supabase = await createClient();
  const { data: old } = await supabase
    .from("supplier_service_types")
    .select("fiscal_classification_id")
    .eq("id", serviceTypeId)
    .single();
  const { error } = await supabase
    .from("supplier_service_types")
    .update({ fiscal_classification_id: classificationId })
    .eq("id", serviceTypeId);
  if (error) throw new Error(error.message);
  await logAudit({
    companyId: await companyId(),
    action: "FISCAL_CLASSIFICATION",
    entityType: "supplier_service_type",
    entityId: serviceTypeId,
    oldValues: { fiscal_classification_id: old?.fiscal_classification_id ?? null },
    newValues: { fiscal_classification_id: classificationId },
  });
  revalidate();
}

/** Asigna la misma clasificación a varios tipos de servicio a la vez (los filtrados en pantalla). */
export async function bulkSetServiceTypeClassificationAction(
  serviceTypeIds: string[],
  classificationId: string | null,
): Promise<{ updated: number }> {
  await requirePermission("settings.manage");
  if (serviceTypeIds.length === 0) return { updated: 0 };
  if (serviceTypeIds.length > 500) throw new Error("Demasiados tipos de servicio a la vez.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("supplier_service_types")
    .update({ fiscal_classification_id: classificationId })
    .in("id", serviceTypeIds);
  if (error) throw new Error(error.message);
  const cid = await companyId();
  await logAudit({
    companyId: cid,
    action: "FISCAL_CLASSIFICATION_BULK",
    entityType: "supplier_service_type",
    entityId: cid,
    newValues: { fiscal_classification_id: classificationId, service_type_ids: serviceTypeIds },
  });
  revalidate();
  return { updated: serviceTypeIds.length };
}
