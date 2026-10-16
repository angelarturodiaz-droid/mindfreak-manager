"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";

export type ActionState = { error: string | null };

export async function createBankCatalogEntryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("settings.manage");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "El nombre del banco es requerido." };

  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) return { error: "Tu usuario no está asignado a ninguna compañía." };
  const companyId = companyIds[0];

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("bank_catalog")
    .insert({ company_id: companyId, name })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "Ese banco ya está en la lista." };
    return { error: error.message };
  }

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "bank_catalog",
    entityId: data.id,
    newValues: { name },
  });

  revalidatePath("/settings/banks");
  return { error: null };
}

export async function toggleBankCatalogActiveAction(
  entryId: string,
  currentlyActive: boolean,
): Promise<void> {
  await requirePermission("settings.manage");
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("bank_catalog")
    .update({ is_active: !currentlyActive })
    .eq("id", entryId);
  if (error) throw new Error(error.message);

  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length > 0) {
    await logAudit({
      companyId: companyIds[0],
      action: currentlyActive ? "DEACTIVATE" : "ACTIVATE",
      entityType: "bank_catalog",
      entityId: entryId,
      newValues: { is_active: !currentlyActive },
    });
  }

  revalidatePath("/settings/banks");
}

export async function deleteBankCatalogEntryAction(entryId: string): Promise<void> {
  await requirePermission("settings.manage");
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("bank_catalog").delete().eq("id", entryId);
  if (error) throw new Error(error.message);

  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length > 0) {
    await logAudit({
      companyId: companyIds[0],
      action: "DELETE",
      entityType: "bank_catalog",
      entityId: entryId,
    });
  }

  revalidatePath("/settings/banks");
}

const LOGO_DATA_URL = /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/;

/**
 * Color y logo de un banco del catálogo (migración 084). Lo usan todas las
 * cuentas y tarjetas de ese banco. `logoData`: data URL ya reducido en el
 * navegador (128 px); null = quitar el logo subido (vuelve al del sistema o a
 * las iniciales); undefined = no cambiarlo.
 */
export async function updateBankBrandAction(
  entryId: string,
  color: string | null,
  logoData: string | null | undefined,
): Promise<{ error: string | null }> {
  await requirePermission("settings.manage");
  if (color !== null && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return { error: "El color no es válido. Elige uno de la lista o con «Otro color…»." };
  }
  if (logoData) {
    if (!LOGO_DATA_URL.test(logoData)) return { error: "El logo debe ser una imagen PNG, JPG, WEBP o SVG." };
    if (logoData.length > 200000) return { error: "El logo es muy grande. Usa una imagen más pequeña (máx. 150 KB)." };
  }
  const supabase = await createSupabaseClient();
  const patch: { brand_color: string | null; logo_data?: string | null } = { brand_color: color };
  if (logoData !== undefined) patch.logo_data = logoData;
  const { data, error } = await supabase
    .from("bank_catalog")
    .update(patch)
    .eq("id", entryId)
    .select("id, company_id, name")
    .maybeSingle();
  if (error || !data) return { error: "No se pudo guardar. Verifica que tengas permiso de Configuración e intenta de nuevo." };

  await logAudit({
    companyId: data.company_id,
    action: "UPDATE",
    entityType: "bank_catalog",
    entityId: entryId,
    newValues: {
      name: data.name,
      brand_color: color,
      logo: logoData === undefined ? "sin cambio" : logoData ? "subido" : "quitado",
    },
  });

  revalidatePath("/settings/banks");
  revalidatePath("/banks", "layout");
  return { error: null };
}
