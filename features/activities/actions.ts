"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { activitySchema } from "./schema";

export type ActionState = { error: string | null };

/**
 * Registra una actividad (llamada, reunión, correo, nota) sobre un proyecto.
 * No existe update/delete a propósito — es una bitácora, no un registro
 * editable (mismo espíritu que audit_logs).
 */
export async function createProjectActivityAction(
  projectId: string,
  revalidatePathValue: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("projects.update");

  const parsed = activitySchema.safeParse({
    type: String(formData.get("type") ?? "NOTE"),
    description: String(formData.get("description") ?? ""),
    activity_date: String(formData.get("activity_date") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    return { error: "Tu usuario no está asignado a ninguna compañía." };
  }

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("activities").insert({
    company_id: companyIds[0],
    project_id: projectId,
    entity_type: "project",
    entity_id: projectId,
    type: parsed.data.type,
    description: parsed.data.description,
    activity_date: parsed.data.activity_date || new Date().toISOString(),
    created_by: user?.id,
  });

  if (error) return { error: error.message };

  revalidatePath(revalidatePathValue);
  return { error: null };
}
