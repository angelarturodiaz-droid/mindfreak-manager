"use server";

import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";

export type ActionState = { error: string | null };

export async function createExpenseCategoryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("settings.manage");

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { error: "El nombre es requerido." };

  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) return { error: "Tu usuario no está asignado a ninguna compañía." };
  const companyId = companyIds[0];

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .insert({ company_id: companyId, name, description: description || null })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "expense_category",
    entityId: data.id,
    newValues: { name, description },
  });

  revalidatePath("/settings/expense-categories");
  return { error: null };
}

export async function deleteExpenseCategoryAction(categoryId: string): Promise<void> {
  await requirePermission("settings.manage");
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("expense_categories").delete().eq("id", categoryId);
  if (error) throw new Error(error.message);

  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length > 0) {
    await logAudit({
      companyId: companyIds[0],
      action: "DELETE",
      entityType: "expense_category",
      entityId: categoryId,
    });
  }

  revalidatePath("/settings/expense-categories");
}

export type ImportCategoriesState = {
  error: string | null;
  result?: { total: number; created: number; skipped: number; skippedNames: string[] };
};

/** Normaliza para comparar nombres: sin acentos, sin mayúsculas, sin espacios extra. */
function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Importación masiva de categorías de gastos desde un CSV.
 * Columnas: "nombre" (requerida) y "descripcion" (opcional). También
 * acepta "name"/"description", o un archivo de una sola columna sin
 * encabezado. Las que ya existen (mismo nombre, sin importar mayúsculas ni
 * acentos) o se repiten dentro del archivo se omiten, no se duplican.
 */
export async function importExpenseCategoriesCsvAction(
  _prevState: ImportCategoriesState,
  formData: FormData,
): Promise<ImportCategoriesState> {
  await requirePermission("settings.manage");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo CSV." };
  }

  const text = (await file.text()).replace(/^\uFEFF/, "");
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return { error: `Error leyendo el CSV: ${parsed.errors[0].message}` };
  }
  const table = parsed.data.map((r) => r.map((c) => String(c ?? "").trim()));
  if (table.length === 0) return { error: "El archivo está vacío." };

  const header = table[0].map((h) => normalizeName(h));
  const nameIdx = header.findIndex((h) => h === "nombre" || h === "name" || h === "categoria");
  const descIdx = header.findIndex((h) => h === "descripcion" || h === "description");
  const hasHeader = nameIdx !== -1;
  const rows = (hasHeader ? table.slice(1) : table).map((r) => ({
    name: r[hasHeader ? nameIdx : 0] ?? "",
    description: descIdx !== -1 ? r[descIdx] ?? "" : hasHeader ? "" : r[1] ?? "",
  }));

  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) return { error: "Tu usuario no está asignado a ninguna compañía." };
  const companyId = companyIds[0];

  const supabase = await createSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("expense_categories")
    .select("name")
    .eq("company_id", companyId);
  if (existingError) return { error: existingError.message };

  const seen = new Set((existing ?? []).map((c) => normalizeName(c.name)));
  const toInsert: { company_id: string; name: string; description: string | null }[] = [];
  const skippedNames: string[] = [];
  for (const r of rows) {
    if (!r.name) continue;
    const key = normalizeName(r.name);
    if (seen.has(key)) {
      skippedNames.push(r.name);
      continue;
    }
    seen.add(key);
    toInsert.push({ company_id: companyId, name: r.name, description: r.description || null });
  }
  const total = rows.filter((r) => r.name).length;
  if (total === 0) return { error: "No se encontró ninguna categoría en el archivo (columna \"nombre\")." };

  if (toInsert.length > 0) {
    const { error } = await supabase.from("expense_categories").insert(toInsert);
    if (error) return { error: error.message };

    await logAudit({
      companyId,
      action: "IMPORT",
      entityType: "expense_category",
      entityId: companyId,
      newValues: { file: file.name, created: toInsert.map((c) => c.name) },
    });
  }

  revalidatePath("/settings/expense-categories");
  return {
    error: null,
    result: { total, created: toInsert.length, skipped: skippedNames.length, skippedNames },
  };
}
