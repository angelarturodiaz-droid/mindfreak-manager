"use server";

/**
 * A0 — Acciones del respaldo. El navegador del administrador pide aquí los datos tabla por tabla y las direcciones
 * firmadas (5 min) de cada documento, y arma el ZIP en su computadora. Nada se guarda en el servidor.
 * La base vuelve a exigir el permiso backups.create y la verificación en dos pasos de ESTA sesión (aal2).
 */
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserCompanyIds, hasPermission } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { reverifyAdminMfa } from "@/lib/mfa/admin-reverify";

const ERRORS: Record<string, string> = {
  backup_forbidden: "No tienes permiso para crear copias de seguridad (solo Administración).",
  backup_needs_aal2: "Confirma tu código de verificación en dos pasos para crear la copia.",
  backup_running: "Ya hay una copia en proceso. Espera a que termine (o, si se cerró la ventana, a que pasen 30 minutos).",
  backup_too_soon: "Espera unos minutos entre una copia y otra (mínimo 5).",
};

function friendly(message: string): string {
  const key = Object.keys(ERRORS).find((k) => message.includes(k));
  return key ? ERRORS[key] : message;
}

async function companyId(): Promise<string> {
  const ids = await getCurrentUserCompanyIds();
  return ids[0];
}

export type BackupTableInfo = { name: string; rows: number; columns: string[] };
export type BackupFileInfo = { path: string; size: number; mime: string | null };

export type StartBackupResult =
  | { error: string }
  | {
      error: null;
      runId: string;
      tables: BackupTableInfo[];
      files: BackupFileInfo[];
      users: unknown[];
      controlTotals: Record<string, unknown>;
      schemaSnapshot: string;
      startedAt: string;
    };

/** Confirma el código de 6 dígitos (deja la sesión en aal2), registra la copia y devuelve qué hay que bajar. */
export async function startBackupAction(kind: "FULL" | "DB_ONLY", mfaCode: string): Promise<StartBackupResult> {
  if (!(await hasPermission("backups.create"))) return { error: ERRORS.backup_forbidden };
  const supabase = await createSupabaseClient();
  try {
    await reverifyAdminMfa(supabase, mfaCode);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo verificar el código." };
  }

  const { data: runId, error: startErr } = await supabase.rpc("backup_start", { p_kind: kind });
  if (startErr || !runId) return { error: friendly(startErr?.message ?? "No se pudo iniciar la copia.") };

  const [tablesRes, usersRes, totalsRes, filesRes, schemaRes] = await Promise.all([
    supabase.rpc("backup_list_tables"),
    supabase.rpc("backup_export_auth_users"),
    supabase.rpc("backup_control_totals"),
    kind === "FULL" ? supabase.rpc("backup_list_files") : Promise.resolve({ data: [], error: null }),
    supabase.rpc("backup_schema_snapshot"),
  ]);
  const firstErr = tablesRes.error ?? usersRes.error ?? totalsRes.error ?? filesRes.error ?? schemaRes.error;
  if (firstErr) {
    await supabase.rpc("backup_finish", {
      p_run_id: runId, p_status: "FALLIDO", p_size_bytes: null, p_table_count: null, p_row_count: null,
      p_file_count: null, p_manifest_sha256: null, p_error: firstErr.message,
    });
    return { error: friendly(firstErr.message) };
  }

  await logAudit({
    companyId: await companyId(),
    action: "BACKUP_STARTED",
    entityType: "backup",
    entityId: runId as string,
    newValues: { tipo: kind === "FULL" ? "Completa (base de datos + documentos)" : "Solo base de datos" },
  });

  type TableRow = { table_name: string; row_count: number; columns: string[] };
  type FileRow = { path: string; size_bytes: number; mime_type: string | null };
  return {
    error: null,
    runId: runId as string,
    tables: ((tablesRes.data ?? []) as TableRow[]).map((t) => ({ name: t.table_name, rows: Number(t.row_count), columns: t.columns })),
    files: ((filesRes.data ?? []) as FileRow[]).map((f) => ({ path: f.path, size: Number(f.size_bytes), mime: f.mime_type })),
    users: (usersRes.data ?? []) as unknown[],
    controlTotals: (totalsRes.data ?? {}) as Record<string, unknown>,
    schemaSnapshot: (schemaRes.data ?? "") as string,
    startedAt: new Date().toISOString(),
  };
}

/** Una página de filas de una tabla (hasta 1,000). */
export async function exportTablePageAction(table: string, offset: number, limit = 1000): Promise<{ error: string | null; rows: Record<string, unknown>[] }> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc("backup_export_table", { p_table: table, p_offset: offset, p_limit: limit });
  if (error) return { error: friendly(error.message), rows: [] };
  return { error: null, rows: (data ?? []) as Record<string, unknown>[] };
}

/** Direcciones firmadas de 5 minutos para bajar los documentos (solo los de la carpeta de la empresa). */
export async function signFilesAction(paths: string[]): Promise<{ error: string | null; urls: Record<string, string> }> {
  if (!(await hasPermission("backups.create"))) return { error: ERRORS.backup_forbidden, urls: {} };
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.storage.from("documents").createSignedUrls(paths, 300);
  if (error) return { error: error.message, urls: {} };
  const urls: Record<string, string> = {};
  for (const item of data ?? []) if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  return { error: null, urls };
}

/** Cierra el registro (COMPLETADO o FALLIDO) y lo anota en la Auditoría. */
export async function finishBackupAction(input: {
  runId: string;
  ok: boolean;
  sizeBytes: number | null;
  tableCount: number | null;
  rowCount: number | null;
  fileCount: number | null;
  manifestSha256: string | null;
  error: string | null;
  kind: "FULL" | "DB_ONLY";
}): Promise<{ error: string | null }> {
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("backup_finish", {
    p_run_id: input.runId,
    p_status: input.ok ? "COMPLETADO" : "FALLIDO",
    p_size_bytes: input.sizeBytes,
    p_table_count: input.tableCount,
    p_row_count: input.rowCount,
    p_file_count: input.fileCount,
    p_manifest_sha256: input.manifestSha256,
    p_error: input.error,
  });
  await logAudit({
    companyId: await companyId(),
    action: input.ok ? "BACKUP_COMPLETED" : "BACKUP_FAILED",
    entityType: "backup",
    entityId: input.runId,
    newValues: {
      tipo: input.kind === "FULL" ? "Completa" : "Solo base de datos",
      tamaño_bytes: input.sizeBytes,
      tablas: input.tableCount,
      filas: input.rowCount,
      documentos: input.fileCount,
      huella_manifest: input.manifestSha256,
      error: input.error,
    },
  });
  revalidatePath("/settings/backups");
  return { error: error ? friendly(error.message) : null };
}
