"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";

export type ActionState = { error: string | null };

export async function createExpenseCategoryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("settings.manage");

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { error: "El nombre es requerido." };

  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) return { error: "Tu usuario no está asignado a ninguna compañía." };
  const companyId = companyIds[0];

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .insert({ company_id: companyId, name, description: description || null })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "expense_category",
    entityId: data.id,
    newValues: { name, description },
  });

  revalidatePath("/settings/expense-categories");
  return { error: null };
}

export async function deleteExpenseCategoryAction(categoryId: string): Promise<void> {
  await requirePermission("settings.manage");
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("expense_categories").delete().eq("id", categoryId);
  if (error) throw new Error(error.message);

  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length > 0) {
    await logAudit({
      companyId: companyIds[0],
      action: "DELETE",
      entityType: "expense_category",
      entityId: categoryId,
    });
  }

  revalidatePath("/settings/expense-categories");
}
