import { createClient } from "@/lib/supabase/server";

export async function listTasks(filters: { status?: string; projectId?: string } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select(
      "id, title, description, due_date, status, priority, project_id, assigned_to, projects(number, name), profiles!assigned_to(full_name)",
    )
    .order("due_date", { ascending: true, nullsFirst: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.projectId) query = query.eq("project_id", filters.projectId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getTask(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}
