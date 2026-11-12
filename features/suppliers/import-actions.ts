"use server";

/**
 * A3 — Carga masiva de proveedores. El navegador lee el Excel y manda las filas como texto; aquí se vuelve a revisar
 * todo con los catálogos actuales (nunca se confía en la revisión de la pantalla) y se guardan solo las filas sin
 * errores. Usa la sesión del usuario (RLS) y el permiso suppliers.create.
 */
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserCompanyIds, hasPermission } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import {
  SUPPLIER_IMPORT_MAX_ROWS,
  validateSupplierRows,
  type ImportCatalogs,
  type SupplierImportRow,
} from "./import";

const NO_PERMISSION = "No tienes permiso para crear proveedores.";
const MAX_CELLS = (SUPPLIER_IMPORT_MAX_ROWS + 1) * 40;

async function loadCatalogs(withExisting: boolean): Promise<{ companyId: string; catalogs: ImportCatalogs }> {
  const [companyId] = await getCurrentUserCompanyIds();
  if (!companyId) throw new Error("Tu usuario no está asignado a ninguna compañía.");
  const supabase = await createSupabaseClient();
  const [cats, types, banks, existing] = await Promise.all([
    supabase.from("expense_categories").select("id, name").eq("company_id", companyId),
    supabase.from("supplier_service_types").select("id, name, category_id").eq("company_id", companyId),
    supabase.from("bank_catalog").select("name").eq("is_active", true),
    withExisting ? supabase.from("suppliers").select("name, tax_id").eq("company_id", companyId) : Promise.resolve({ data: [] }),
  ]);
  return {
    companyId,
    catalogs: {
      categories: cats.data ?? [],
      serviceTypes: (types.data ?? []).filter((t) => t.category_id) as ImportCatalogs["serviceTypes"],
      banks: (banks.data ?? []).map((b) => b.name),
      existingTaxIds: (existing.data ?? []).map((s) => String(s.tax_id ?? "").replace(/\W/g, "").toUpperCase()).filter(Boolean),
      existingNames: (existing.data ?? []).map((s) => String(s.name ?? "")),
    },
  };
}

function cleanRows(rows: unknown): string[][] | null {
  if (!Array.isArray(rows) || rows.length > SUPPLIER_IMPORT_MAX_ROWS + 1) return null;
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

/** Catálogos para armar la plantilla (categorías, tipos de servicio y bancos). */
export async function getSupplierTemplateDataAction(): Promise<
  { error: string } | { error: null; catalogs: Pick<ImportCatalogs, "categories" | "serviceTypes" | "banks"> }
> {
  if (!(await hasPermission("suppliers.create"))) return { error: NO_PERMISSION };
  const { catalogs } = await loadCatalogs(false);
  return { error: null, catalogs: { categories: catalogs.categories, serviceTypes: catalogs.serviceTypes, banks: catalogs.banks } };
}

/** Revisa el archivo sin guardar nada. */
export async function previewSupplierImportAction(
  rows: string[][],
): Promise<{ error: string } | { error: null; results: SupplierImportRow[] }> {
  if (!(await hasPermission("suppliers.create"))) return { error: NO_PERMISSION };
  const clean = cleanRows(rows);
  if (!clean) return { error: `El archivo es demasiado grande (máximo ${SUPPLIER_IMPORT_MAX_ROWS} filas).` };
  const { catalogs } = await loadCatalogs(true);
  const v = validateSupplierRows(clean, catalogs);
  if (v.error) return { error: v.error };
  return { error: null, results: v.results };
}

export type SupplierImportCommitResult =
  | { error: string }
  | { error: null; imported: number; skipped: SupplierImportRow[]; failed: { row: number; name: string; error: string }[] };

/** Vuelve a revisar y guarda las filas sin errores (con aviso o sin nada). */
export async function commitSupplierImportAction(rows: string[][], fileName: string): Promise<SupplierImportCommitResult> {
  if (!(await hasPermission("suppliers.create"))) return { error: NO_PERMISSION };
  const clean = cleanRows(rows);
  if (!clean) return { error: `El archivo es demasiado grande (máximo ${SUPPLIER_IMPORT_MAX_ROWS} filas).` };
  const { companyId, catalogs } = await loadCatalogs(true);
  const v = validateSupplierRows(clean, catalogs);
  if (v.error) return { error: v.error };

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const failed: { row: number; name: string; error: string }[] = [];
  let imported = 0;
  const now = new Date().toISOString();

  for (const r of v.results) {
    if (!r.record) continue;
    const { contact, ...rec } = r.record;
    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        company_id: companyId,
        ...rec,
        directory_status: "PROVEEDOR",
        fiscal_reviewed_at: rec.supplier_kind && rec.fiscal_condition ? now : null,
        created_by: user?.id,
      })
      .select("id")
      .single();
    if (error || !data) {
      failed.push({ row: r.row, name: r.name, error: error?.message ?? "No se pudo guardar." });
      continue;
    }
    imported++;
    if (contact) {
      await supabase.from("supplier_contacts").insert({ supplier_id: data.id, company_id: companyId, ...contact, is_primary: true });
    }
  }

  const skipped = v.results.filter((r) => r.status === "error");
  const errorCount = skipped.length + failed.length;
  const { data: batch } = await supabase.from("import_batches").insert({
    company_id: companyId,
    entity_type: "suppliers",
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
  }).select("id").single();
  await logAudit({
    companyId,
    action: "IMPORT",
    entityType: "import_batch",
    entityId: batch?.id ?? companyId,
    newValues: { archivo: fileName, filas: v.results.length, importados: imported, con_error: errorCount },
  });

  revalidatePath("/suppliers");
  revalidatePath("/suppliers/import");
  return { error: null, imported, skipped, failed };
}
