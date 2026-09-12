import { createClient } from "@/lib/supabase/server";

export async function listDocuments(entityType: string, entityId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, file_name, mime_type, size_bytes, storage_path, created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}
