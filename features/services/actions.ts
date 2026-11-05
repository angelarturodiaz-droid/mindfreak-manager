"use server";

import { DEFAULT_UNIT_CODE, UNITS, unitName } from "@/lib/dgii/catalogs";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { hasPermission, requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { serviceCategorySchema, serviceSchema } from "./schema";

export type ActionState = { error: string | null; success?: string; successId?: number };

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

export async function createServiceCategoryAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await hasPermission("settings.manage"))) return { error: "Solo Administración puede cambiar el catálogo de productos y servicios." };

  const parsed = serviceCategorySchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("service_categories").insert({
    company_id: companyId,
    name: parsed.data.name,
    description: parsed.data.description || null,
  });

  if (error) {
    if (error.code === "23505") return { error: `Ya existe una categoría llamada «${parsed.data.name}» (no cuentan mayúsculas ni acentos).` };
    return { error: error.message };
  }

  revalidatePath("/services");
  return { error: null, success: `Categoría «${parsed.data.name}» agregada.`, successId: Date.now() };
}

/** 5b — Unidad e-CF (Tabla IV); si no es válida queda la predeterminada (Unidad). */
function unitCodeFrom(formData: FormData): string {
  const code = String(formData.get("unit_code") ?? "");
  return UNITS.some((u) => u.value === code) ? code : DEFAULT_UNIT_CODE;
}

const NO_PERMISSION = "Solo Administración puede cambiar el catálogo de productos y servicios.";

/** Cambiar el nombre o la descripción de una categoría (el nombre no se puede repetir; migración 101). */
export async function updateServiceCategoryAction(
  categoryId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await hasPermission("settings.manage"))) return { error: NO_PERMISSION };
  const parsed = serviceCategorySchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const supabase = await createSupabaseClient();
  const { data: before } = await supabase.from("service_categories").select("name, description").eq("id", categoryId).single();
  const { error } = await supabase
    .from("service_categories")
    .update({ name: parsed.data.name, description: parsed.data.description || null })
    .eq("id", categoryId);
  if (error) {
    if (error.code === "23505") return { error: `Ya existe una categoría llamada «${parsed.data.name}» (no cuentan mayúsculas ni acentos).` };
    return { error: error.message };
  }
  await logAudit({
    companyId: await getPrimaryCompanyId(),
    action: "UPDATE",
    entityType: "service_category",
    entityId: categoryId,
    oldValues: before,
    newValues: parsed.data,
  });
  revalidatePath("/services");
  return { error: null, success: `Categoría «${parsed.data.name}» guardada.`, successId: Date.now() };
}

/** Borrar una categoría vacía (con productos o servicios, aunque estén inactivos, no se puede: migración 101). */
export async function deleteServiceCategoryAction(categoryId: string): Promise<ActionState> {
  if (!(await hasPermission("settings.manage"))) return { error: NO_PERMISSION };
  const supabase = await createSupabaseClient();
  const { data: before } = await supabase.from("service_categories").select("name, description").eq("id", categoryId).single();
  const { error } = await supabase.from("service_categories").delete().eq("id", categoryId);
  if (error) {
    if (error.message.includes("category_in_use"))
      return { error: `«${before?.name ?? "La categoría"}» tiene productos o servicios: muévelos a otra categoría antes de borrarla.` };
    return { error: error.message };
  }
  await logAudit({
    companyId: await getPrimaryCompanyId(),
    action: "DELETE",
    entityType: "service_category",
    entityId: categoryId,
    oldValues: before,
  });
  revalidatePath("/services");
  return { error: null, success: `Categoría «${before?.name ?? ""}» borrada.`, successId: Date.now() };
}

export async function createServiceAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await hasPermission("settings.manage"))) return { error: "Solo Administración puede cambiar el catálogo de productos y servicios." };

  const rawCategoryId = String(formData.get("category_id") ?? "");
  const parsed = serviceSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    category_id: rawCategoryId,
    type: String(formData.get("type") ?? "SERVICIO"),
    description: String(formData.get("description") ?? ""),
    // 5-nov: una sola «Unidad» (la de la lista oficial); el texto «por hora» sale de ella.
    unit: unitName(unitCodeFrom(formData)).toLowerCase(),
    default_price: String(formData.get("default_price") ?? "0"),
    default_cost: String(formData.get("default_cost") ?? "0"),
    default_tax_rate_id: String(formData.get("default_tax_rate_id") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("services")
    .insert({
      company_id: companyId,
      category_id: parsed.data.category_id || null,
      name: parsed.data.name,
      type: parsed.data.type,
      description: parsed.data.description || null,
      unit: parsed.data.unit || null,
      unit_code: unitCodeFrom(formData),
      default_price: parsed.data.default_price,
      default_cost: parsed.data.default_cost,
      default_tax_rate_id: parsed.data.default_tax_rate_id || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "service",
    entityId: data.id,
    newValues: parsed.data,
  });

  revalidatePath("/services");
  redirect(`/services/${data.id}`);
}

export async function updateServiceAction(
  serviceId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await hasPermission("settings.manage"))) return { error: "Solo Administración puede cambiar el catálogo de productos y servicios." };

  const rawCategoryId = String(formData.get("category_id") ?? "");
  const parsed = serviceSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    category_id: rawCategoryId,
    type: String(formData.get("type") ?? "SERVICIO"),
    description: String(formData.get("description") ?? ""),
    // 5-nov: una sola «Unidad» (la de la lista oficial); el texto «por hora» sale de ella.
    unit: unitName(unitCodeFrom(formData)).toLowerCase(),
    default_price: String(formData.get("default_price") ?? "0"),
    default_cost: String(formData.get("default_cost") ?? "0"),
    default_tax_rate_id: String(formData.get("default_tax_rate_id") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createSupabaseClient();
  const { data: before } = await supabase
    .from("services")
    .select("name, category_id, type, description, unit, unit_code, default_price, default_cost, default_tax_rate_id")
    .eq("id", serviceId)
    .single();

  const { error } = await supabase
    .from("services")
    .update({
      name: parsed.data.name,
      category_id: parsed.data.category_id || null,
      type: parsed.data.type,
      description: parsed.data.description || null,
      unit: parsed.data.unit || null,
      unit_code: unitCodeFrom(formData),
      default_price: parsed.data.default_price,
      default_cost: parsed.data.default_cost,
      default_tax_rate_id: parsed.data.default_tax_rate_id || null,
    })
    .eq("id", serviceId);

  if (error) return { error: error.message };

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "service",
    entityId: serviceId,
    oldValues: before,
    newValues: parsed.data,
  });

  revalidatePath(`/services/${serviceId}`);
  revalidatePath("/services");
  return { error: null };
}

/** Desactivar servicio (soft delete — no se borra físicamente, puede estar referenciado por cotizaciones/facturas pasadas). */
export async function deactivateServiceAction(serviceId: string): Promise<void> {
  await requirePermission("settings.manage");

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("services")
    .update({ is_active: false })
    .eq("id", serviceId);

  if (error) throw new Error(error.message);

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "DEACTIVATE",
    entityType: "service",
    entityId: serviceId,
  });

  revalidatePath(`/services/${serviceId}`);
  revalidatePath("/services");
}
