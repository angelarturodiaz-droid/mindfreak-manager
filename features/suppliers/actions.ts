"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { supplierSchema, supplierContactSchema } from "./schema";

export type ActionState = { error: string | null };

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

function parseFormFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    tax_id: String(formData.get("tax_id") ?? ""),
    category: String(formData.get("category") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    address: String(formData.get("address") ?? ""),
  };
}

export async function createSupplierAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("suppliers.create");

  const parsed = supplierSchema.safeParse(parseFormFields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      company_id: companyId,
      name: parsed.data.name,
      tax_id: parsed.data.tax_id || null,
      category: parsed.data.category || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "supplier",
    entityId: data.id,
    newValues: parsed.data,
  });

  revalidatePath("/suppliers");
  redirect(`/suppliers/${data.id}`);
}

export async function updateSupplierAction(
  supplierId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("suppliers.update");

  const parsed = supplierSchema.safeParse(parseFormFields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createSupabaseClient();
  const { data: before } = await supabase
    .from("suppliers")
    .select("name, tax_id, category, email, phone, address")
    .eq("id", supplierId)
    .single();

  const { error } = await supabase
    .from("suppliers")
    .update({
      name: parsed.data.name,
      tax_id: parsed.data.tax_id || null,
      category: parsed.data.category || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
    })
    .eq("id", supplierId);

  if (error) return { error: error.message };

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "supplier",
    entityId: supplierId,
    oldValues: before,
    newValues: parsed.data,
  });

  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/suppliers");
  return { error: null };
}

/** Desactivar proveedor (soft delete — nunca se borra físicamente). */
export async function deactivateSupplierAction(supplierId: string): Promise<void> {
  await requirePermission("suppliers.delete");

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ is_active: false })
    .eq("id", supplierId);

  if (error) throw new Error(error.message);

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "DEACTIVATE",
    entityType: "supplier",
    entityId: supplierId,
  });

  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/suppliers");
}

export async function createSupplierContactAction(
  supplierId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("suppliers.update");

  const parsed = supplierContactSchema.safeParse({
    full_name: String(formData.get("full_name") ?? ""),
    position: String(formData.get("position") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    is_primary: formData.get("is_primary") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("supplier_contacts").insert({
    supplier_id: supplierId,
    company_id: companyId,
    full_name: parsed.data.full_name,
    position: parsed.data.position || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    is_primary: parsed.data.is_primary,
  });

  if (error) return { error: error.message };

  revalidatePath(`/suppliers/${supplierId}`);
  return { error: null };
}

export async function deleteSupplierContactAction(
  contactId: string,
  supplierId: string,
): Promise<void> {
  await requirePermission("suppliers.delete");
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("supplier_contacts")
    .delete()
    .eq("id", contactId);
  if (error) throw new Error(error.message);
  revalidatePath(`/suppliers/${supplierId}`);
}
