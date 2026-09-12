import { createClient } from "@/lib/supabase/server";

export async function listProjectActivities(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("id, type, description, activity_date, profiles!created_by(full_name)")
    .eq("project_id", projectId)
    .order("activity_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}
