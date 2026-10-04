"use server";

import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { normalizeCatalogName } from "./classification";

export type ActionState = { error: string | null; success?: string; successId?: number };

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

  // Sin repetidos en toda la empresa: un tipo de servicio vive en una sola categoría.
  const { data: existing } = await supabase
    .from("supplier_service_types")
    .select("name, category_id, expense_categories(name)")
    .eq("company_id", companyId);
  const same = (existing ?? []).find((t) => normalizeCatalogName(t.name) === normalizeCatalogName(name));
  if (same) {
    const cat = same.expense_categories as { name: string } | { name: string }[] | null;
    const catName = Array.isArray(cat) ? cat[0]?.name : cat?.name;
    return {
      error:
        same.category_id === categoryId
          ? `"${same.name}" ya existe en esta categoría. No se puede repetir.`
          : `"${same.name}" ya existe en la categoría "${catName ?? "otra"}". Un tipo de servicio solo puede estar en una categoría.`,
    };
  }

  const { data, error } = await supabase
    .from("supplier_service_types")
    .insert({ company_id: companyId, category_id: categoryId, name })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: `"${name}" ya existe. No se puede repetir.` };
    return { error: error.message };
  }

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "supplier_service_type",
    entityId: data.id,
    newValues: { name, category_id: categoryId },
  });

  revalidateAll();
  return { error: null, success: `Tipo de servicio "${name}" creado.`, successId: Date.now() };
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
  result?: {
    total: number;
    created: number;
    skipped: number;
    categoriesCreated: string[];
    /** Tipos a los que se les puso la clasificación fiscal (columna opcional). */
    classified?: number;
    /** Valores de clasificación que no se reconocieron. */
    unknownClassifications?: string[];
  };
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
  const descIdx = header.findIndex((h) =>
    ["descripcion categoria", "descripcion", "description"].includes(h),
  );
  // Opcional: clasificación fiscal (nombre o código, ej. "Servicio técnico" o SERVICIO_TECNICO).
  const fiscalIdx = header.findIndex((h) => ["clasificacion fiscal", "clasificacion", "fiscal"].includes(h));
  if (catIdx === -1 || typeIdx === -1) {
    return { error: 'El CSV debe tener las columnas "categoria" y "tipo_servicio" (descarga la plantilla).' };
  }
  const allRows = table.slice(1).map((r) => ({
    category: r[catIdx] ?? "",
    name: r[typeIdx] ?? "",
    description: descIdx !== -1 ? (r[descIdx] ?? "") : "",
    fiscal: fiscalIdx !== -1 ? (r[fiscalIdx] ?? "") : "",
  }));
  // Filas con categoría y tipo vacío: solo crean la categoría (si falta).
  const rows = allRows.filter((r) => r.category && r.name);
  if (allRows.every((r) => !r.category)) return { error: "No se encontró ninguna categoría en el archivo." };

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();

  const [{ data: categories, error: catError }, { data: types, error: typeError }, { data: fiscalRows }] =
    await Promise.all([
      supabase.from("expense_categories").select("id, name").eq("company_id", companyId),
      supabase.from("supplier_service_types").select("id, name, category_id").eq("company_id", companyId),
      supabase.from("fiscal_classifications").select("id, code, name").eq("company_id", companyId),
    ]);
  const fiscalMap = new Map<string, string>();
  for (const f of fiscalRows ?? []) {
    fiscalMap.set(normalizeCatalogName(f.name), f.id);
    fiscalMap.set(normalizeCatalogName(f.code.replace(/_/g, " ")), f.id);
  }
  const typeIdByName = new Map((types ?? []).map((t) => [normalizeCatalogName(t.name), t.id as string]));
  const unknownClassifications = new Set<string>();
  const classifyExisting: { id: string; fiscalId: string }[] = [];
  if (catError) return { error: catError.message };
  if (typeError) return { error: typeError.message };

  const categoryMap = new Map((categories ?? []).map((c) => [normalizeCatalogName(c.name), c.id]));
  // Un tipo de servicio no se repite en toda la empresa (en ninguna categoría).
  const seen = new Set((types ?? []).map((t) => normalizeCatalogName(t.name)));
  const categoriesCreated: string[] = [];
  const toInsert: {
    company_id: string;
    category_id: string;
    name: string;
    fiscal_classification_id?: string | null;
  }[] = [];
  let skipped = 0;

  for (const r of allRows.filter((x) => x.category)) {
    const catKey = normalizeCatalogName(r.category);
    let categoryId = categoryMap.get(catKey);
    if (!categoryId) {
      const { data, error } = await supabase
        .from("expense_categories")
        .insert({
          company_id: companyId,
          name: r.category,
          description: r.description || "Creada al importar tipos de servicio",
        })
        .select("id")
        .single();
      if (error || !data) return { error: error?.message ?? "No se pudo crear la categoría." };
      categoryId = data.id as string;
      categoryMap.set(catKey, categoryId);
      categoriesCreated.push(r.category);
    }
    if (!r.name) continue;
    const key = normalizeCatalogName(r.name);
    let fiscalId: string | null = null;
    if (r.fiscal) {
      fiscalId = fiscalMap.get(normalizeCatalogName(r.fiscal.replace(/_/g, " "))) ?? null;
      if (!fiscalId) unknownClassifications.add(r.fiscal);
    }
    if (seen.has(key)) {
      skipped++;
      // Ya existe: si el archivo trae clasificación fiscal, se le asigna.
      const existingId = typeIdByName.get(key);
      if (existingId && fiscalId) classifyExisting.push({ id: existingId, fiscalId });
      continue;
    }
    seen.add(key);
    toInsert.push({ company_id: companyId, category_id: categoryId, name: r.name, fiscal_classification_id: fiscalId });
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

  for (const c of classifyExisting) {
    const { error } = await supabase
      .from("supplier_service_types")
      .update({ fiscal_classification_id: c.fiscalId })
      .eq("id", c.id);
    if (error) return { error: error.message };
  }
  const classified = toInsert.filter((t) => t.fiscal_classification_id).length + classifyExisting.length;
  if (classifyExisting.length > 0) {
    await logAudit({
      companyId,
      action: "FISCAL_CLASSIFICATION_BULK",
      entityType: "supplier_service_type",
      entityId: companyId,
      newValues: { file: file.name, classified: classifyExisting },
    });
  }

  revalidateAll();
  revalidatePath("/settings/expense-categories");
  return {
    error: null,
    result: {
      total: rows.length,
      created: toInsert.length,
      skipped,
      categoriesCreated,
      classified,
      unknownClassifications: [...unknownClassifications],
    },
  };
}
