"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { taskSchema, TASK_STATUSES } from "./schema";

export type ActionState = { error: string | null };

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

export async function createTaskAction(
  revalidatePathValue: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("projects.update");

  const parsed = taskSchema.safeParse({
    project_id: String(formData.get("project_id") ?? ""),
    assigned_to: String(formData.get("assigned_to") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    due_date: String(formData.get("due_date") ?? ""),
    priority: String(formData.get("priority") ?? "MEDIUM"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("tasks").insert({
    company_id: companyId,
    project_id: parsed.data.project_id || null,
    assigned_to: parsed.data.assigned_to || null,
    title: parsed.data.title,
    description: parsed.data.description || null,
    due_date: parsed.data.due_date || null,
    priority: parsed.data.priority,
    status: "PENDING",
    created_by: user?.id,
  });

  if (error) return { error: error.message };

  revalidatePath(revalidatePathValue);
  return { error: null };
}

export async function updateTaskStatusAction(
  taskId: string,
  status: string,
  revalidatePathValue: string,
): Promise<void> {
  await requirePermission("projects.update");
  if (!TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) {
    throw new Error("Estado inválido.");
  }
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId);
  if (error) throw new Error(error.message);

  revalidatePath(revalidatePathValue);
}

export async function deleteTaskAction(
  taskId: string,
  revalidatePathValue: string,
): Promise<void> {
  await requirePermission("projects.update");
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);

  revalidatePath(revalidatePathValue);
}
