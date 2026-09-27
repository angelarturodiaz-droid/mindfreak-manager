"use server";

import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { normalizeCatalogName } from "./classification";

export type ActionState = { error: string | null };

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) throw new Error("Tu usuario no está asignado a ninguna compañía.");
  return companyIds[0];
}

function revalidateAll() {
  revalidatePath("/settings/service-types");
  revalidatePath("/suppliers");
}

/** Nuevo tipo de servicio dentro de una categoría (ej. Audiovisuales → Alquiler de sonido). */
export async function createServiceTypeAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("settings.manage");

  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "");
  if (!categoryId) return { error: "Elige la categoría a la que pertenece." };
  if (!name) return { error: "Escribe el tipo de servicio." };

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();

  const { data: existing } = await supabase
    .from("supplier_service_types")
    .select("name")
    .eq("company_id", companyId)
    .eq("category_id", categoryId);
  if ((existing ?? []).some((t) => normalizeCatalogName(t.name) === normalizeCatalogName(name))) {
    return { error: `"${name}" ya existe en esa categoría.` };
  }

  const { data, error } = await supabase
    .from("supplier_service_types")
    .insert({ company_id: companyId, category_id: categoryId, name })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "supplier_service_type",
    entityId: data.id,
    newValues: { name, category_id: categoryId },
  });

  revalidateAll();
  return { error: null };
}

export async function deleteServiceTypeAction(serviceTypeId: string): Promise<void> {
  await requirePermission("settings.manage");
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("supplier_service_types").delete().eq("id", serviceTypeId);
  if (error) throw new Error(error.message);

  await logAudit({
    companyId: await getPrimaryCompanyId(),
    action: "DELETE",
    entityType: "supplier_service_type",
    entityId: serviceTypeId,
  });
  revalidateAll();
}

export type ImportServiceTypesState = {
  error: string | null;
  result?: { total: number; created: number; skipped: number; categoriesCreated: string[] };
};

/**
 * Importación masiva desde CSV. Columnas: "categoria" y "tipo_servicio"
 * (también acepta "tipo de servicio", "servicio" o "nombre"). Si la
 * categoría no existe se crea en Configuración > Categorías. Los tipos que
 * ya existen en esa categoría (sin importar mayúsculas ni acentos) se
 * omiten.
 */
export async function importServiceTypesCsvAction(
  _prevState: ImportServiceTypesState,
  formData: FormData,
): Promise<ImportServiceTypesState> {
  await requirePermission("settings.manage");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona un archivo CSV." };

  const text = (await file.text()).replace(/^﻿/, "");
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const table = parsed.data.map((r) => r.map((c) => String(c ?? "").trim()));
  if (table.length === 0) return { error: "El archivo está vacío." };

  const header = table[0].map((h) => normalizeCatalogName(h).replace(/_/g, " "));
  const catIdx = header.findIndex((h) => h === "categoria" || h === "category");
  const typeIdx = header.findIndex((h) =>
    ["tipo servicio", "tipo de servicio", "servicio", "nombre", "service type", "name"].includes(h),
  );
  if (catIdx === -1 || typeIdx === -1) {
    return { error: 'El CSV debe tener las columnas "categoria" y "tipo_servicio" (descarga la plantilla).' };
  }
  const rows = table
    .slice(1)
    .map((r) => ({ category: r[catIdx] ?? "", name: r[typeIdx] ?? "" }))
    .filter((r) => r.category && r.name);
  if (rows.length === 0) return { error: "No se encontró ningún tipo de servicio en el archivo." };

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();

  const [{ data: categories, error: catError }, { data: types, error: typeError }] = await Promise.all([
    supabase.from("expense_categories").select("id, name").eq("company_id", companyId),
    supabase.from("supplier_service_types").select("name, category_id").eq("company_id", companyId),
  ]);
  if (catError) return { error: catError.message };
  if (typeError) return { error: typeError.message };

  const categoryMap = new Map((categories ?? []).map((c) => [normalizeCatalogName(c.name), c.id]));
  const seen = new Set((types ?? []).map((t) => `${t.category_id}|${normalizeCatalogName(t.name)}`));
  const categoriesCreated: string[] = [];
  const toInsert: { company_id: string; category_id: string; name: string }[] = [];
  let skipped = 0;

  for (const r of rows) {
    const catKey = normalizeCatalogName(r.category);
    let categoryId = categoryMap.get(catKey);
    if (!categoryId) {
      const { data, error } = await supabase
        .from("expense_categories")
        .insert({ company_id: companyId, name: r.category, description: "Creada al importar tipos de servicio" })
        .select("id")
        .single();
      if (error || !data) return { error: error?.message ?? "No se pudo crear la categoría." };
      categoryId = data.id as string;
      categoryMap.set(catKey, categoryId);
      categoriesCreated.push(r.category);
    }
    const key = `${categoryId}|${normalizeCatalogName(r.name)}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    toInsert.push({ company_id: companyId, category_id: categoryId, name: r.name });
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("supplier_service_types").insert(toInsert);
    if (error) return { error: error.message };
    await logAudit({
      companyId,
      action: "IMPORT",
      entityType: "supplier_service_type",
      entityId: companyId,
      newValues: { file: file.name, created: toInsert.map((t) => t.name), categoriesCreated },
    });
  }

  revalidateAll();
  revalidatePath("/settings/expense-categories");
  return {
    error: null,
    result: { total: rows.length, created: toInsert.length, skipped, categoriesCreated },
  };
}
