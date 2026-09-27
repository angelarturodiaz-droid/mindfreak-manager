import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Normaliza para comparar nombres: sin acentos, sin mayúsculas, sin espacios extra. */
export function normalizeCatalogName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type SupplierClassification = {
  category_id: string | null;
  category: string | null;
  service_type_id: string | null;
  service_type: string | null;
};

/**
 * Formulario de proveedor: valida la categoría y el tipo de servicio
 * elegidos y devuelve también sus nombres (se guardan en las columnas de
 * texto para que listados e importación sigan igual).
 */
export async function resolveSupplierClassification(
  supabase: Supabase,
  companyId: string,
  categoryId: string | null,
  serviceTypeId: string | null,
): Promise<{ error: string } | SupplierClassification> {
  if (!categoryId) {
    if (serviceTypeId) return { error: "Elige primero la categoría del proveedor." };
    return { category_id: null, category: null, service_type_id: null, service_type: null };
  }
  const { data: category } = await supabase
    .from("expense_categories")
    .select("id, name")
    .eq("id", categoryId)
    .eq("company_id", companyId)
    .single();
  if (!category) return { error: "La categoría elegida no existe." };

  if (!serviceTypeId) {
    return { category_id: category.id, category: category.name, service_type_id: null, service_type: null };
  }
  const { data: serviceType } = await supabase
    .from("supplier_service_types")
    .select("id, name, category_id")
    .eq("id", serviceTypeId)
    .eq("company_id", companyId)
    .single();
  if (!serviceType) return { error: "El tipo de servicio elegido no existe." };
  if (serviceType.category_id !== category.id) {
    return { error: `El tipo de servicio "${serviceType.name}" no pertenece a la categoría "${category.name}".` };
  }
  return {
    category_id: category.id,
    category: category.name,
    service_type_id: serviceType.id,
    service_type: serviceType.name,
  };
}

/**
 * Importación de proveedores (CSV con textos): busca la categoría y el
 * tipo de servicio por nombre y, si no existen, los crea en los catálogos.
 * Si el usuario no tiene permiso para crear en Configuración, se guarda
 * solo el texto (como antes).
 */
export async function classificationFromNames(
  supabase: Supabase,
  companyId: string,
  categoryName: string,
  serviceTypeName: string,
  cache: { categories?: Map<string, { id: string; name: string }>; types?: Map<string, { id: string; name: string }> },
): Promise<SupplierClassification> {
  const catText = categoryName.trim();
  const typeText = serviceTypeName.trim();
  const result: SupplierClassification = {
    category_id: null,
    category: catText || null,
    service_type_id: null,
    service_type: typeText || null,
  };
  if (!catText) return result;

  if (!cache.categories) {
    const { data } = await supabase.from("expense_categories").select("id, name").eq("company_id", companyId);
    cache.categories = new Map((data ?? []).map((c) => [normalizeCatalogName(c.name), c]));
  }
  let category = cache.categories.get(normalizeCatalogName(catText));
  if (!category) {
    const { data } = await supabase
      .from("expense_categories")
      .insert({ company_id: companyId, name: catText, description: "Creada al importar proveedores" })
      .select("id, name")
      .single();
    if (!data) return result;
    category = data;
    cache.categories.set(normalizeCatalogName(catText), data);
  }
  result.category_id = category.id;
  result.category = category.name;
  if (!typeText) return result;

  if (!cache.types) {
    const { data } = await supabase
      .from("supplier_service_types")
      .select("id, name, category_id")
      .eq("company_id", companyId);
    cache.types = new Map((data ?? []).map((t) => [`${t.category_id}|${normalizeCatalogName(t.name)}`, t]));
  }
  const key = `${category.id}|${normalizeCatalogName(typeText)}`;
  let serviceType = cache.types.get(key);
  if (!serviceType) {
    const { data } = await supabase
      .from("supplier_service_types")
      .insert({ company_id: companyId, category_id: category.id, name: typeText })
      .select("id, name")
      .single();
    if (!data) return result;
    serviceType = data;
    cache.types.set(key, data);
  }
  result.service_type_id = serviceType.id;
  result.service_type = serviceType.name;
  return result;
}
