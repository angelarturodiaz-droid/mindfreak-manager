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
