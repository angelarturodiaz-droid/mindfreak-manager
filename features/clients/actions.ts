"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Papa from "papaparse";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { clientSchema, clientContactSchema } from "./schema";

export type ActionState = { error: string | null };

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0]; // V1 opera con una sola compañía por usuario (sección A del F0)
}

function parseFormFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    tax_id: String(formData.get("tax_id") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    address: String(formData.get("address") ?? ""),
    status: String(formData.get("status") ?? "LEAD"),
  };
}

export async function createClientAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("clients.create");

  const parsed = clientSchema.safeParse(parseFormFields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("clients")
    .insert({
      company_id: companyId,
      name: parsed.data.name,
      tax_id: parsed.data.tax_id || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      status: parsed.data.status,
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "client",
    entityId: data.id,
    newValues: parsed.data,
  });

  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

export async function updateClientAction(
  clientId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("clients.update");

  const parsed = clientSchema.omit({ status: true }).safeParse(parseFormFields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createSupabaseClient();
  const { data: before } = await supabase
    .from("clients")
    .select("name, tax_id, email, phone, address")
    .eq("id", clientId)
    .single();

  const { error } = await supabase
    .from("clients")
    .update({
      name: parsed.data.name,
      tax_id: parsed.data.tax_id || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
    })
    .eq("id", clientId);

  if (error) return { error: error.message };

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "client",
    entityId: clientId,
    oldValues: before,
    newValues: parsed.data,
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { error: null };
}

/** Convertir un cliente potencial (LEAD) a cliente activo (ACTIVE). */
export async function convertClientToActiveAction(clientId: string): Promise<void> {
  await requirePermission("clients.convert");

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("clients")
    .update({ status: "ACTIVE" })
    .eq("id", clientId)
    .eq("status", "LEAD"); // idempotente: no falla si ya estaba ACTIVE

  if (error) throw new Error(error.message);

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "CONVERT_TO_ACTIVE",
    entityType: "client",
    entityId: clientId,
    newValues: { status: "ACTIVE" },
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
}

/** Desactivar cliente (soft delete — nunca se borra físicamente). */
export async function deactivateClientAction(clientId: string): Promise<void> {
  await requirePermission("clients.delete");

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("clients")
    .update({ is_active: false })
    .eq("id", clientId);

  if (error) throw new Error(error.message);

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "DEACTIVATE",
    entityType: "client",
    entityId: clientId,
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
}

export async function createContactAction(
  clientId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("clients.update");

  const parsed = clientContactSchema.safeParse({
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
  const { error } = await supabase.from("client_contacts").insert({
    client_id: clientId,
    company_id: companyId,
    full_name: parsed.data.full_name,
    position: parsed.data.position || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    is_primary: parsed.data.is_primary,
  });

  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}`);
  return { error: null };
}

export async function deleteContactAction(
  contactId: string,
  clientId: string,
): Promise<void> {
  await requirePermission("clients.delete");
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("client_contacts")
    .delete()
    .eq("id", contactId);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${clientId}`);
}

export type ImportActionState = {
  error: string | null;
  result?: { total: number; success: number; errors: number };
};

/** Importación masiva de clientes vía CSV. Ver F0-Arquitectura, sección G (import_batches). */
export async function importClientsCsvAction(
  _prevState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  await requirePermission("clients.import");

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
    const candidate = clientSchema.safeParse({
      name: row.name ?? "",
      tax_id: row.tax_id ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      address: row.address ?? "",
      status: (row.status === "ACTIVE" ? "ACTIVE" : "LEAD") as "LEAD" | "ACTIVE",
    });

    if (!candidate.success) {
      errorDetails.push({
        row: i + 2, // +2: encabezado + índice base 1
        error: candidate.error.issues[0]?.message ?? "Datos inválidos",
      });
      continue;
    }

    const { error } = await supabase.from("clients").insert({
      company_id: companyId,
      name: candidate.data.name,
      tax_id: candidate.data.tax_id || null,
      email: candidate.data.email || null,
      phone: candidate.data.phone || null,
      address: candidate.data.address || null,
      status: candidate.data.status,
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
    entity_type: "clients",
    file_name: file.name,
    total_rows: rows.length,
    success_count: successCount,
    error_count: errorDetails.length,
    error_details: errorDetails.length > 0 ? errorDetails : null,
    status,
    created_by: user?.id,
  });

  revalidatePath("/clients");
  revalidatePath("/clients/import");

  return {
    error: null,
    result: { total: rows.length, success: successCount, errors: errorDetails.length },
  };
}
