"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import {
  quotationHeaderSchema,
  quotationItemSchema,
  calculateItemSubtotal,
  calculateQuotationTotals,
} from "./schema";
import { QuotationPdfDocument } from "@/lib/pdf/quotation-document";

export type ActionState = { error: string | null };

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

async function generateQuotationNumber(companyId: string): Promise<string> {
  const supabase = await createSupabaseClient();
  const { count } = await supabase
    .from("quotations")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `COT-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

/** Recalcula y guarda los totales de la cotización a partir de sus líneas actuales. */
async function recalculateQuotationTotals(quotationId: string) {
  const supabase = await createSupabaseClient();
  const { data: items, error } = await supabase
    .from("quotation_items")
    .select("quantity, unit_price, discount, tax, estimated_unit_cost")
    .eq("quotation_id", quotationId);
  if (error) throw new Error(error.message);

  const totals = calculateQuotationTotals(items ?? []);
  const { error: updateError } = await supabase
    .from("quotations")
    .update(totals)
    .eq("id", quotationId);
  if (updateError) throw new Error(updateError.message);
}

export async function createQuotationAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("quotations.create");

  const parsed = quotationHeaderSchema.safeParse({
    client_id: String(formData.get("client_id") ?? ""),
    contact_id: String(formData.get("contact_id") ?? ""),
    issue_date: String(formData.get("issue_date") ?? ""),
    valid_until: String(formData.get("valid_until") ?? ""),
    currency: String(formData.get("currency") ?? "DOP"),
    exchange_rate: String(formData.get("exchange_rate") ?? "1"),
    terms: String(formData.get("terms") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const number = await generateQuotationNumber(companyId);
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("quotations")
    .insert({
      company_id: companyId,
      client_id: parsed.data.client_id,
      contact_id: parsed.data.contact_id || null,
      number,
      issue_date: parsed.data.issue_date,
      valid_until: parsed.data.valid_until || null,
      currency: parsed.data.currency,
      exchange_rate: parsed.data.exchange_rate,
      terms: parsed.data.terms || null,
      status: "DRAFT",
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "quotation",
    entityId: data.id,
    newValues: parsed.data,
  });

  revalidatePath("/quotations");
  redirect(`/quotations/${data.id}`);
}

export async function updateQuotationHeaderAction(
  quotationId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("quotations.update");

  const parsed = quotationHeaderSchema.safeParse({
    client_id: String(formData.get("client_id") ?? ""),
    contact_id: String(formData.get("contact_id") ?? ""),
    issue_date: String(formData.get("issue_date") ?? ""),
    valid_until: String(formData.get("valid_until") ?? ""),
    currency: String(formData.get("currency") ?? "DOP"),
    exchange_rate: String(formData.get("exchange_rate") ?? "1"),
    terms: String(formData.get("terms") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("quotations")
    .update({
      client_id: parsed.data.client_id,
      contact_id: parsed.data.contact_id || null,
      issue_date: parsed.data.issue_date,
      valid_until: parsed.data.valid_until || null,
      currency: parsed.data.currency,
      exchange_rate: parsed.data.exchange_rate,
      terms: parsed.data.terms || null,
    })
    .eq("id", quotationId);

  if (error) return { error: error.message };

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "quotation",
    entityId: quotationId,
    newValues: parsed.data,
  });

  revalidatePath(`/quotations/${quotationId}`);
  return { error: null };
}

export async function addQuotationItemAction(
  quotationId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("quotations.update");

  const parsed = quotationItemSchema.safeParse({
    service_id: String(formData.get("service_id") ?? ""),
    description: String(formData.get("description") ?? ""),
    quantity: String(formData.get("quantity") ?? "1"),
    unit_price: String(formData.get("unit_price") ?? "0"),
    discount: String(formData.get("discount") ?? "0"),
    tax: String(formData.get("tax") ?? "0"),
    estimated_unit_cost: String(formData.get("estimated_unit_cost") ?? "0"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const subtotal = calculateItemSubtotal(parsed.data);
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("quotation_items").insert({
    quotation_id: quotationId,
    service_id: parsed.data.service_id || null,
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    unit_price: parsed.data.unit_price,
    discount: parsed.data.discount,
    tax: parsed.data.tax,
    estimated_unit_cost: parsed.data.estimated_unit_cost,
    subtotal,
  });

  if (error) return { error: error.message };

  await recalculateQuotationTotals(quotationId);
  revalidatePath(`/quotations/${quotationId}`);
  return { error: null };
}

export async function deleteQuotationItemAction(
  itemId: string,
  quotationId: string,
): Promise<void> {
  await requirePermission("quotations.update");
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("quotation_items")
    .delete()
    .eq("id", itemId);
  if (error) throw new Error(error.message);

  await recalculateQuotationTotals(quotationId);
  revalidatePath(`/quotations/${quotationId}`);
}

async function changeQuotationStatus(
  quotationId: string,
  newStatus: string,
  permission: string,
  extra?: Record<string, unknown>,
) {
  await requirePermission(permission);
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("quotations")
    .update({ status: newStatus, ...extra })
    .eq("id", quotationId);
  if (error) throw new Error(error.message);

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: `STATUS_${newStatus}`,
    entityType: "quotation",
    entityId: quotationId,
    newValues: { status: newStatus },
  });

  revalidatePath(`/quotations/${quotationId}`);
  revalidatePath("/quotations");
}

export async function sendQuotationAction(quotationId: string): Promise<void> {
  await changeQuotationStatus(quotationId, "SENT", "quotations.update");
}

export async function approveQuotationAction(quotationId: string): Promise<void> {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await changeQuotationStatus(quotationId, "APPROVED", "quotations.approve", {
    approved_by: user?.id,
    approved_at: new Date().toISOString(),
  });
}

export async function rejectQuotationAction(quotationId: string): Promise<void> {
  await changeQuotationStatus(quotationId, "REJECTED", "quotations.approve");
}

export async function cancelQuotationAction(quotationId: string): Promise<void> {
  await changeQuotationStatus(quotationId, "CANCELLED", "quotations.update");
}

/**
 * Genera el PDF de la cotización, lo sube a Storage y devuelve una URL firmada
 * (7 días de vigencia) para compartir por WhatsApp/correo. Ver F0-Arquitectura,
 * sección R (V1: link de descarga vía Storage).
 */
export async function generateQuotationShareLinkAction(
  quotationId: string,
): Promise<{ url: string | null; error: string | null }> {
  await requirePermission("quotations.view");

  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  const [{ data: quotation, error: qError }, { data: items, error: iError }, { data: company }] =
    await Promise.all([
      supabase.from("quotations").select("*, clients(name)").eq("id", quotationId).single(),
      supabase
        .from("quotation_items")
        .select("description, quantity, unit_price, discount, subtotal")
        .eq("quotation_id", quotationId)
        .order("sort_order"),
      supabase
        .from("companies")
        .select("name, legal_name, tax_id")
        .eq("id", companyId)
        .single(),
    ]);

  if (qError || !quotation) return { url: null, error: qError?.message ?? "Cotización no encontrada." };
  if (iError) return { url: null, error: iError.message };

  const clientData = quotation.clients as { name: string } | { name: string }[] | null;
  const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;

  const buffer = await renderToBuffer(
    QuotationPdfDocument({
      company: company ?? { name: "Mindfreak Manager", legal_name: null, tax_id: null },
      quotation,
      client: { name: clientName ?? "Cliente" },
      items: items ?? [],
    }),
  );

  const path = `${companyId}/quotations/${quotationId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });

  if (uploadError) return { url: null, error: uploadError.message };

  // Registrar/actualizar metadata en `documents`. No usamos upsert porque
  // `documents` no tiene (ni debe tener) una unicidad global por entidad —
  // otras entidades sí permiten múltiples documentos (fotos, recibos, etc.).
  // Para el PDF de cotización sí queremos un solo registro "canónico" por
  // cotización, así que buscamos y actualizamos si ya existe.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existingDoc } = await supabase
    .from("documents")
    .select("id")
    .eq("entity_type", "quotation")
    .eq("entity_id", quotationId)
    .maybeSingle();

  const docRow = {
    company_id: companyId,
    entity_type: "quotation",
    entity_id: quotationId,
    file_name: `${quotation.number}.pdf`,
    storage_path: path,
    mime_type: "application/pdf",
    size_bytes: buffer.length,
    uploaded_by: user?.id,
  };

  if (existingDoc) {
    await supabase.from("documents").update(docRow).eq("id", existingDoc.id);
  } else {
    await supabase.from("documents").insert(docRow);
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 días

  if (signError || !signed) {
    return { url: null, error: signError?.message ?? "No se pudo generar el link." };
  }

  return { url: signed.signedUrl, error: null };
}
