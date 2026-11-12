"use server";

/**
 * A4 — Carga masiva de clientes. El navegador lee el Excel y manda las filas como texto; aquí se vuelve a revisar todo
 * y se guardan solo las filas sin errores, con sus contactos. Sesión del usuario (RLS) y permiso clients.import.
 */
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserCompanyIds, hasPermission } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { buildWorkbook } from "@/lib/xlsx/workbook";
import { CLIENT_IMPORT_MAX_ROWS, clientTemplateSheets, validateClientRows, type ClientImportRow } from "./import";

const NO_PERMISSION = "No tienes permiso para importar clientes.";
const MAX_CELLS = (CLIENT_IMPORT_MAX_ROWS + 1) * 40;

function cleanRows(rows: unknown): string[][] | null {
  if (!Array.isArray(rows) || rows.length > CLIENT_IMPORT_MAX_ROWS + 1) return null;
  let cells = 0;
  const out: string[][] = [];
  for (const r of rows) {
    if (!Array.isArray(r)) return null;
    cells += r.length;
    if (cells > MAX_CELLS) return null;
    out.push(r.map((c) => String(c ?? "").slice(0, 500)));
  }
  return out;
}

async function existing() {
  const [companyId] = await getCurrentUserCompanyIds();
  if (!companyId) throw new Error("Tu usuario no está asignado a ninguna compañía.");
  const supabase = await createSupabaseClient();
  const { data } = await supabase.from("clients").select("name, tax_id").eq("company_id", companyId);
  return {
    companyId,
    catalogs: {
      existingTaxIds: (data ?? []).map((c) => String(c.tax_id ?? "").replace(/\D/g, "")).filter(Boolean),
      existingNames: (data ?? []).map((c) => String(c.name ?? "")),
    },
  };
}

/** Plantilla (no depende de catálogos de la empresa: etapas, provincias y municipios oficiales). */
export async function getClientTemplateAction(): Promise<{ error: string } | { error: null; bytes: Uint8Array }> {
  if (!(await hasPermission("clients.import"))) return { error: NO_PERMISSION };
  return { error: null, bytes: buildWorkbook(clientTemplateSheets()) };
}

export async function previewClientImportAction(
  rows: string[][],
): Promise<{ error: string } | { error: null; results: ClientImportRow[] }> {
  if (!(await hasPermission("clients.import"))) return { error: NO_PERMISSION };
  const clean = cleanRows(rows);
  if (!clean) return { error: `El archivo es demasiado grande (máximo ${CLIENT_IMPORT_MAX_ROWS} filas).` };
  const { catalogs } = await existing();
  const v = validateClientRows(clean, catalogs);
  if (v.error) return { error: v.error };
  return { error: null, results: v.results };
}

export async function commitClientImportAction(
  rows: string[][],
  fileName: string,
): Promise<
  | { error: string }
  | { error: null; imported: number; skipped: ClientImportRow[]; failed: { row: number; name: string; error: string }[] }
> {
  if (!(await hasPermission("clients.import"))) return { error: NO_PERMISSION };
  const clean = cleanRows(rows);
  if (!clean) return { error: `El archivo es demasiado grande (máximo ${CLIENT_IMPORT_MAX_ROWS} filas).` };
  const { companyId, catalogs } = await existing();
  const v = validateClientRows(clean, catalogs);
  if (v.error) return { error: v.error };

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const failed: { row: number; name: string; error: string }[] = [];
  let imported = 0;

  for (const r of v.results) {
    if (!r.record) continue;
    const { contacts, ...rec } = r.record;
    const { data, error } = await supabase
      .from("clients")
      .insert({ company_id: companyId, ...rec, created_by: user?.id })
      .select("id")
      .single();
    if (error || !data) {
      failed.push({ row: r.row, name: r.name, error: error?.message ?? "No se pudo guardar." });
      continue;
    }
    imported++;
    if (contacts.length) {
      await supabase.from("client_contacts").insert(contacts.map((c) => ({ ...c, client_id: data.id, company_id: companyId })));
    }
  }

  const skipped = v.results.filter((r) => r.status === "error");
  const errorCount = skipped.length + failed.length;
  const { data: batch } = await supabase
    .from("import_batches")
    .insert({
      company_id: companyId,
      entity_type: "clients",
      file_name: fileName.slice(0, 200),
      total_rows: v.results.length,
      success_count: imported,
      error_count: errorCount,
      error_details: errorCount
        ? [
            ...skipped.map((r) => ({ row: r.row, error: r.messages.filter((m) => m.level === "error").map((m) => m.text).join(" · ") })),
            ...failed.map((f) => ({ row: f.row, error: f.error })),
          ]
        : null,
      status: errorCount === 0 ? "COMPLETED" : imported === 0 ? "FAILED" : "COMPLETED_WITH_ERRORS",
      created_by: user?.id,
    })
    .select("id")
    .single();
  await logAudit({
    companyId,
    action: "IMPORT",
    entityType: "import_batch",
    entityId: batch?.id ?? companyId,
    newValues: { archivo: fileName, tipo: "clientes", filas: v.results.length, importados: imported, con_error: errorCount },
  });

  revalidatePath("/clients");
  revalidatePath("/clients/import");
  return { error: null, imported, skipped, failed };
}
