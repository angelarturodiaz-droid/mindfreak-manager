"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Papa from "papaparse";
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
    bank_name: String(formData.get("bank_name") ?? ""),
    bank_account_number: String(formData.get("bank_account_number") ?? ""),
    service_type: String(formData.get("service_type") ?? ""),
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
      bank_name: parsed.data.bank_name || null,
      bank_account_number: parsed.data.bank_account_number || null,
      service_type: parsed.data.service_type || null,
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
    .select("name, tax_id, category, email, phone, address, bank_name, bank_account_number, service_type")
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
      bank_name: parsed.data.bank_name || null,
      bank_account_number: parsed.data.bank_account_number || null,
      service_type: parsed.data.service_type || null,
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

export type ImportActionState = {
  error: string | null;
  result?: { total: number; success: number; errors: number };
};

/** Importación masiva de proveedores vía CSV — mismo patrón que Clientes. */
export async function importSuppliersCsvAction(
  _prevState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  await requirePermission("suppliers.create");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo CSV." };
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    return { error: `Error leyendo el CSV: ${parsed.errors[0].message}` };
  }

  const rows = parsed.data;
  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const errorDetails: { row: number; error: string }[] = [];
  let successCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const candidate = supplierSchema.safeParse({
      name: row.name ?? "",
      tax_id: row.tax_id ?? "",
      category: row.category ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      address: row.address ?? "",
      bank_name: row.bank_name ?? "",
      bank_account_number: row.bank_account_number ?? "",
      service_type: row.service_type ?? "",
    });

    if (!candidate.success) {
      errorDetails.push({
        row: i + 2, // +2: encabezado + índice base 1
        error: candidate.error.issues[0]?.message ?? "Datos inválidos",
      });
      continue;
    }

    const { error } = await supabase.from("suppliers").insert({
      company_id: companyId,
      name: candidate.data.name,
      tax_id: candidate.data.tax_id || null,
      category: candidate.data.category || null,
      email: candidate.data.email || null,
      phone: candidate.data.phone || null,
      address: candidate.data.address || null,
      bank_name: candidate.data.bank_name || null,
      bank_account_number: candidate.data.bank_account_number || null,
      service_type: candidate.data.service_type || null,
      created_by: user?.id,
    });

    if (error) {
      errorDetails.push({ row: i + 2, error: error.message });
    } else {
      successCount++;
    }
  }

  const status =
    errorDetails.length === 0
      ? "COMPLETED"
      : successCount === 0
        ? "FAILED"
        : "COMPLETED_WITH_ERRORS";

  await supabase.from("import_batches").insert({
    company_id: companyId,
    entity_type: "suppliers",
    file_name: file.name,
    total_rows: rows.length,
    success_count: successCount,
    error_count: errorDetails.length,
    error_details: errorDetails.length > 0 ? errorDetails : null,
    status,
    created_by: user?.id,
  });

  revalidatePath("/suppliers");
  revalidatePath("/suppliers/import");

  return {
    error: null,
    result: { total: rows.length, success: successCount, errors: errorDetails.length },
  };
}
