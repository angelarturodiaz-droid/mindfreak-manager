import { createClient } from "@/lib/supabase/server";

/** Opciones para el selector de Tipo de servicio (se filtran por categoría en el formulario). */
export async function listServiceTypeOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_service_types")
    .select("id, name, category_id")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

/** Lista para Configuración > Tipos de servicio, con su categoría y cuántos proveedores lo usan. */
export async function listServiceTypesWithUsage() {
  const supabase = await createClient();
  const [{ data: types, error }, { data: suppliers, error: supError }] = await Promise.all([
    supabase
      .from("supplier_service_types")
      .select("id, name, category_id, expense_categories(name)")
      .order("name"),
    supabase.from("suppliers").select("service_type_id").not("service_type_id", "is", null),
  ]);
  if (error) throw new Error(error.message);
  if (supError) throw new Error(supError.message);

  const usage = new Map<string, number>();
  for (const s of suppliers ?? []) {
    if (s.service_type_id) usage.set(s.service_type_id, (usage.get(s.service_type_id) ?? 0) + 1);
  }
  return (types ?? [])
    .map((t) => {
      const cat = t.expense_categories as { name: string } | { name: string }[] | null;
      const categoryName = (Array.isArray(cat) ? cat[0]?.name : cat?.name) ?? "—";
      return { ...t, categoryName, supplierCount: usage.get(t.id) ?? 0 };
    })
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName, "es") || a.name.localeCompare(b.name, "es"));
}
