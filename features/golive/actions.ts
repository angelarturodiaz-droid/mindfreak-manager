"use server";

/**
 * A1 — Limpieza Go-Live. Todo lo decide la base (golive_* en la migración 104): permiso golive.manage, verificación
 * en dos pasos de ESTA sesión, base PRODUCCIÓN sin Go-Live declarado, respaldo completo de 24 h, vista previa de
 * 30 min y nombre de la empresa. Aquí solo se confirma el código de 6 dígitos y se borran los archivos de Storage con
 * la sesión del administrador (sin llave de servicio).
 */
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserCompanyIds, hasPermission } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { reverifyAdminMfa } from "@/lib/mfa/admin-reverify";
import { golivePreviewFrom, type GoLivePreview, type GoLiveChecks, checksFrom } from "./types";

const ERRORS: Record<string, string> = {
  golive_forbidden: "Solo un Administrador puede preparar el Go-Live.",
  golive_needs_aal2: "Confirma tu código de verificación en dos pasos.",
  golive_not_production: "Esta base no está marcada como PRODUCCIÓN: aquí no se puede hacer la limpieza.",
  golive_locked: "El Go-Live ya fue declarado: la limpieza está bloqueada para siempre. Las correcciones se hacen con anulaciones.",
  golive_preview_expired: "La vista previa venció (vale 30 minutos). Hazla otra vez.",
  golive_needs_backup: "Primero crea un respaldo completo en Configuración → Copias de seguridad. Debe ser de las últimas 24 horas.",
  golive_confirm_name: "Escribe el nombre de la empresa exactamente como aparece.",
  golive_changed: "Los datos cambiaron desde la vista previa (alguien registró algo). Hazla otra vez.",
  golive_orphans: "La limpieza encontró referencias rotas y se deshizo completa: no se borró nada. Avísale a soporte.",
  golive_needs_cleanup: "Primero haz la limpieza completa, incluidos los archivos.",
  golive_run: "No se encontró esa limpieza.",
};

function friendly(message: string): string {
  const key = Object.keys(ERRORS).find((k) => message.includes(k));
  return key ? ERRORS[key] : message;
}

async function companyId(): Promise<string> {
  const ids = await getCurrentUserCompanyIds();
  return ids[0];
}

async function verify(code: string): Promise<string | null> {
  if (!(await hasPermission("golive.manage"))) return ERRORS.golive_forbidden;
  const supabase = await createSupabaseClient();
  try {
    await reverifyAdminMfa(supabase, code);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "No se pudo verificar el código.";
  }
}

/** Vista previa: no borra nada. Pide el código de 6 dígitos. */
export async function goLivePreviewAction(mfaCode: string): Promise<{ error: string } | { error: null; preview: GoLivePreview }> {
  const bad = await verify(mfaCode);
  if (bad) return { error: bad };
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc("golive_preview");
  if (error || !data) return { error: friendly(error?.message ?? "No se pudo hacer la vista previa.") };
  const preview = golivePreviewFrom(data);
  await logAudit({
    companyId: await companyId(),
    action: "GO_LIVE_PREVIEW",
    entityType: "golive_cleanup",
    entityId: preview.previewId,
    newValues: { registros: preview.total, archivos: preview.fileCount },
  });
  return { error: null, preview };
}

export type ExecuteResult = { error: string } | { error: null; runId: string; filesTotal: number; filesLeft: number };

/** Borra los datos de prueba (una transacción en la base) y después los archivos de Storage. */
export async function goLiveExecuteAction(previewId: string, companyName: string): Promise<ExecuteResult> {
  if (!(await hasPermission("golive.manage"))) return { error: ERRORS.golive_forbidden };
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc("golive_execute", { p_preview_id: previewId, p_company_name: companyName });
  if (error || !data) return { error: friendly(error?.message ?? "No se pudo hacer la limpieza.") };
  const res = data as { run_id: string; files: { bucket: string; path: string }[] };
  const left = await removeFiles(res.run_id, res.files);
  revalidatePath("/", "layout");
  return { error: null, runId: res.run_id, filesTotal: res.files.length, filesLeft: left };
}

/** Reintenta borrar los archivos que quedaron (si se cortó la conexión). */
export async function goLiveRetryFilesAction(runId: string): Promise<{ error: string | null; filesLeft: number }> {
  if (!(await hasPermission("golive.manage"))) return { error: ERRORS.golive_forbidden, filesLeft: -1 };
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc("golive_storage_finish", { p_run_id: runId });
  if (error) return { error: friendly(error.message), filesLeft: -1 };
  const files = ((data as { left: { bucket: string; path: string }[] } | null)?.left ?? []);
  const left = await removeFiles(runId, files);
  revalidatePath("/settings/golive");
  return { error: null, filesLeft: left };
}

async function removeFiles(runId: string, files: { bucket: string; path: string }[]): Promise<number> {
  const supabase = await createSupabaseClient();
  const byBucket = new Map<string, string[]>();
  for (const f of files) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.path]);
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += 100) {
      // Un error aquí no detiene nada: golive_storage_finish cuenta lo que quedó y se puede reintentar.
      await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
    }
  }
  const { data } = await supabase.rpc("golive_storage_finish", { p_run_id: runId });
  return ((data as { left: unknown[] } | null)?.left ?? []).length;
}

/** Comprobaciones automáticas después de limpiar. */
export async function goLiveValidateAction(): Promise<{ error: string } | { error: null; checks: GoLiveChecks }> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc("golive_validate");
  if (error) return { error: friendly(error.message) };
  return { error: null, checks: checksFrom(data) };
}

/** Declarar Go-Live: bloquea la limpieza para siempre. Pide el código y el nombre de la empresa. */
export async function goLiveDeclareAction(mfaCode: string, companyName: string): Promise<{ error: string | null }> {
  const bad = await verify(mfaCode);
  if (bad) return { error: bad };
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("golive_declare", { p_company_name: companyName });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/", "layout");
  return { error: null };
}
