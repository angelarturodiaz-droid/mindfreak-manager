"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";

export type ActionState = { error: string | null };

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

/**
 * Sube un archivo (recibo, contrato, foto, comprobante, etc.) y lo asocia a
 * cualquier entidad (proyecto, cliente, proveedor, gasto, etc.) vía el patrón
 * polimórfico entity_type/entity_id — ver F0-Arquitectura, sección "Documentos".
 * Reutilizable: la misma action sirve para todos los módulos.
 */
export async function uploadDocumentAction(
  entityType: string,
  entityId: string,
  revalidatePathValue: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("documents.upload");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo." };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { error: "El archivo no puede superar 15MB." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${companyId}/${entityType}/${entityId}/${Date.now()}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, buffer, { contentType: file.type || "application/octet-stream" });
  if (uploadError) return { error: uploadError.message };

  const { data, error } = await supabase
    .from("documents")
    .insert({
      company_id: companyId,
      entity_type: entityType,
      entity_id: entityId,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      uploaded_by: user?.id,
    })
    .select("id")
    .single();

  if (error) {
    // limpiar el archivo huérfano en Storage si falló el insert de metadata
    await supabase.storage.from("documents").remove([path]);
    return { error: error.message };
  }

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "document",
    entityId: data.id,
    newValues: { entity_type: entityType, entity_id: entityId, file_name: file.name },
  });

  revalidatePath(revalidatePathValue);
  return { error: null };
}

export async function deleteDocumentAction(
  documentId: string,
  storagePath: string,
  revalidatePathValue: string,
): Promise<void> {
  await requirePermission("documents.upload");
  const supabase = await createSupabaseClient();

  const { error: dbError } = await supabase.from("documents").delete().eq("id", documentId);
  if (dbError) throw new Error(dbError.message);

  await supabase.storage.from("documents").remove([storagePath]);

  revalidatePath(revalidatePathValue);
}

export async function getDocumentDownloadUrlAction(
  storagePath: string,
): Promise<{ url: string | null; error: string | null }> {
  await requirePermission("documents.view");
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 60 * 10); // 10 minutos
  if (error || !data) return { url: null, error: error?.message ?? "No se pudo generar el link." };
  return { url: data.signedUrl, error: null };
}
