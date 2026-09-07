"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { serviceCategorySchema, serviceSchema } from "./schema";

export type ActionState = { error: string | null };

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
  await requirePermission("settings.manage");

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

  if (error) return { error: error.message };

  revalidatePath("/services");
  return { error: null };
}

export async function createServiceAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("settings.manage");

  const rawCategoryId = String(formData.get("category_id") ?? "");
  const parsed = serviceSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    category_id: rawCategoryId,
    unit: String(formData.get("unit") ?? ""),
    default_price: String(formData.get("default_price") ?? "0"),
    default_cost: String(formData.get("default_cost") ?? "0"),
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
      unit: parsed.data.unit || null,
      default_price: parsed.data.default_price,
      default_cost: parsed.data.default_cost,
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
  await requirePermission("settings.manage");

  const rawCategoryId = String(formData.get("category_id") ?? "");
  const parsed = serviceSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    category_id: rawCategoryId,
    unit: String(formData.get("unit") ?? ""),
    default_price: String(formData.get("default_price") ?? "0"),
    default_cost: String(formData.get("default_cost") ?? "0"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createSupabaseClient();
  const { data: before } = await supabase
    .from("services")
    .select("name, category_id, unit, default_price, default_cost")
    .eq("id", serviceId)
    .single();

  const { error } = await supabase
    .from("services")
    .update({
      name: parsed.data.name,
      category_id: parsed.data.category_id || null,
      unit: parsed.data.unit || null,
      default_price: parsed.data.default_price,
      default_cost: parsed.data.default_cost,
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
