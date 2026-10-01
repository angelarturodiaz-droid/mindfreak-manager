"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { safeReturnTo, withReturnTo } from "@/lib/utils/return-to";
import {
  deliveryHeaderSchema,
  deliveryItemSchema,
  signedUploadSchema,
  type DeliveryItemInput,
  type DeliveryHeaderInput,
} from "./schema";
import type { DeliveryReceiptPdfData } from "@/lib/pdf/delivery-receipt-document";

export type ActionState = { error: string | null; success?: string; successId?: number };

const MAX_SIGNED_SIZE = 15 * 1024 * 1024; // 15MB, igual que los demás adjuntos

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) throw new Error("Tu usuario no está asignado a ninguna compañía.");
  return companyIds[0];
}

/** Siguiente número ACU-0001, ACU-0002… (máximo real, igual que facturas). */
async function generateDeliveryNumber(companyId: string): Promise<string> {
  const supabase = await createSupabaseClient();
  const { data } = await supabase.from("delivery_receipts").select("number").eq("company_id", companyId);
  const maxNum = (data ?? []).reduce((max, row) => {
    const n = parseInt(String(row.number).replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `ACU-${String(maxNum + 1).padStart(4, "0")}`;
}

function revalidateDelivery(id: string, clientId?: string | null) {
  revalidatePath("/deliveries");
  revalidatePath(`/deliveries/${id}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

/** Lee el formulario: encabezado + líneas (JSON en el campo oculto "items"). */
function parseDeliveryForm(formData: FormData) {
  const header = deliveryHeaderSchema.safeParse({
    client_id: String(formData.get("client_id") ?? ""),
    project_id: String(formData.get("project_id") ?? ""),
    delivery_type: String(formData.get("delivery_type") ?? "DOCUMENTS"),
    subtitle: String(formData.get("subtitle") ?? ""),
    delivery_date: String(formData.get("delivery_date") ?? ""),
    place: String(formData.get("place") ?? ""),
    recipient_name: String(formData.get("recipient_name") ?? ""),
    recipient_short_name: String(formData.get("recipient_short_name") ?? ""),
    recipient_department: String(formData.get("recipient_department") ?? ""),
    reference: String(formData.get("reference") ?? ""),
    intro_text: String(formData.get("intro_text") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    copies: String(formData.get("copies") ?? "2"),
    delivered_by_name: String(formData.get("delivered_by_name") ?? ""),
    delivered_by_id_number: String(formData.get("delivered_by_id_number") ?? ""),
  });
  if (!header.success) return { error: header.error.issues[0]?.message ?? "Datos inválidos." } as const;

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "No se pudieron leer las líneas del acuse." } as const;
  }
  const list = Array.isArray(rawItems) ? rawItems : [];
  // Filas totalmente vacías se ignoran (el formulario siempre deja una en blanco).
  const nonEmpty = list.filter(
    (r) => r && typeof r === "object" && (String((r as Record<string, unknown>).description ?? "").trim() || String((r as Record<string, unknown>).reference ?? "").trim()),
  );
  if (nonEmpty.length === 0) return { error: "Agrega al menos una línea con lo que se entrega." } as const;
  if (nonEmpty.length > 60) return { error: "Máximo 60 líneas por acuse." } as const;

  const items: DeliveryItemInput[] = [];
  for (let i = 0; i < nonEmpty.length; i++) {
    const parsed = deliveryItemSchema.safeParse(nonEmpty[i]);
    if (!parsed.success) return { error: `Línea ${i + 1}: ${parsed.error.issues[0]?.message ?? "datos inválidos."}` } as const;
    items.push(parsed.data);
  }
  return { header: header.data, items } as const;
}

/** El cliente (y el proyecto, si viene) deben ser de la misma empresa. */
async function validateRelations(companyId: string, clientId: string, projectId: string | null) {
  const supabase = await createSupabaseClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!client) return "El cliente elegido no existe.";
  if (projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("id, client_id")
      .eq("id", projectId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!project) return "El proyecto elegido no existe.";
    if (project.client_id && project.client_id !== clientId) return "El proyecto elegido es de otro cliente.";
  }
  return null;
}

function headerRow(d: DeliveryHeaderInput) {
  return {
    client_id: d.client_id,
    project_id: d.project_id || null,
    delivery_type: d.delivery_type,
    subtitle: d.subtitle || null,
    delivery_date: d.delivery_date,
    place: d.place || null,
    recipient_name: d.recipient_name,
    recipient_short_name: d.recipient_short_name || null,
    recipient_department: d.recipient_department || null,
    reference: d.reference || null,
    intro_text: d.intro_text || null,
    notes: d.notes || null,
    copies: d.copies,
    delivered_by_name: d.delivered_by_name || null,
    delivered_by_id_number: d.delivered_by_id_number || null,
  };
}

function itemRows(companyId: string, receiptId: string, items: DeliveryItemInput[]) {
  return items.map((it, i) => ({
    company_id: companyId,
    receipt_id: receiptId,
    position: i + 1,
    description: it.description,
    reference: it.reference || null,
    quantity: it.quantity,
  }));
}

export async function createDeliveryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("deliveries.create");
  const parsed = parseDeliveryForm(formData);
  if ("error" in parsed) return { error: parsed.error ?? "Datos inválidos." };

  const companyId = await getPrimaryCompanyId();
  const relError = await validateRelations(companyId, parsed.header.client_id, parsed.header.project_id || null);
  if (relError) return { error: relError };

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let receiptId: string | null = null;
  let number = "";
  // Dos intentos por si otro usuario tomó el mismo número al mismo tiempo.
  for (let attempt = 0; attempt < 2 && !receiptId; attempt++) {
    number = await generateDeliveryNumber(companyId);
    const { data, error } = await supabase
      .from("delivery_receipts")
      .insert({ company_id: companyId, number, created_by: user?.id ?? null, ...headerRow(parsed.header) })
      .select("id")
      .single();
    if (data) receiptId = data.id;
    else if (error && error.code !== "23505") return { error: error.message };
  }
  if (!receiptId) return { error: "No se pudo asignar un número al acuse. Inténtalo de nuevo." };

  const { error: itemsError } = await supabase.from("delivery_receipt_items").insert(itemRows(companyId, receiptId, parsed.items));
  if (itemsError) {
    await supabase.from("delivery_receipts").delete().eq("id", receiptId);
    return { error: itemsError.message };
  }

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "delivery_receipt",
    entityId: receiptId,
    newValues: { number, ...parsed.header, items: parsed.items.length },
  });

  revalidateDelivery(receiptId, parsed.header.client_id);
  const returnTo = safeReturnTo(String(formData.get("return_to") ?? ""));
  redirect(withReturnTo(`/deliveries/${receiptId}`, returnTo));
}

export async function updateDeliveryAction(
  receiptId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("deliveries.create");
  const parsed = parseDeliveryForm(formData);
  if ("error" in parsed) return { error: parsed.error ?? "Datos inválidos." };

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const { data: before } = await supabase
    .from("delivery_receipts")
    .select("status, client_id")
    .eq("id", receiptId)
    .single();
  if (!before) return { error: "Acuse no encontrado." };
  if (!["DRAFT", "ISSUED"].includes(before.status)) {
    return { error: "Este acuse ya está firmado o anulado y no se puede editar." };
  }
  const relError = await validateRelations(companyId, parsed.header.client_id, parsed.header.project_id || null);
  if (relError) return { error: relError };

  const { error } = await supabase.from("delivery_receipts").update(headerRow(parsed.header)).eq("id", receiptId);
  if (error) return { error: error.message };

  // Las líneas se reemplazan completas (mismo orden que en el formulario).
  const { error: delError } = await supabase.from("delivery_receipt_items").delete().eq("receipt_id", receiptId);
  if (delError) return { error: delError.message };
  const { error: insError } = await supabase.from("delivery_receipt_items").insert(itemRows(companyId, receiptId, parsed.items));
  if (insError) return { error: insError.message };

  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "delivery_receipt",
    entityId: receiptId,
    newValues: { ...parsed.header, items: parsed.items.length },
  });

  revalidateDelivery(receiptId, parsed.header.client_id);
  if (before.client_id !== parsed.header.client_id) revalidatePath(`/clients/${before.client_id}`);
  const returnTo = safeReturnTo(String(formData.get("return_to") ?? ""));
  redirect(withReturnTo(`/deliveries/${receiptId}`, returnTo));
}

/** Borrador → Pendiente de firma (ya se imprimió y se entregó para firmar). */
export async function issueDeliveryAction(receiptId: string): Promise<void> {
  await requirePermission("deliveries.create");
  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("delivery_receipts")
    .update({ status: "ISSUED", issued_at: new Date().toISOString() })
    .eq("id", receiptId)
    .eq("status", "DRAFT")
    .select("client_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solo un acuse en borrador se puede marcar como pendiente de firma.");
  await logAudit({ companyId, action: "ISSUE", entityType: "delivery_receipt", entityId: receiptId });
  revalidateDelivery(receiptId, data.client_id);
}

/** Pendiente de firma → Borrador (por si hay que corregirlo antes de entregarlo). */
export async function backToDraftDeliveryAction(receiptId: string): Promise<void> {
  await requirePermission("deliveries.create");
  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("delivery_receipts")
    .update({ status: "DRAFT", issued_at: null })
    .eq("id", receiptId)
    .eq("status", "ISSUED")
    .select("client_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solo un acuse pendiente de firma puede volver a borrador.");
  await logAudit({ companyId, action: "UPDATE", entityType: "delivery_receipt", entityId: receiptId, newValues: { status: "DRAFT" } });
  revalidateDelivery(receiptId, data.client_id);
}

export async function cancelDeliveryAction(receiptId: string): Promise<void> {
  await requirePermission("deliveries.cancel");
  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("delivery_receipts")
    .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
    .eq("id", receiptId)
    .neq("status", "CANCELLED")
    .select("client_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Este acuse ya está anulado.");
  await logAudit({ companyId, action: "CANCEL", entityType: "delivery_receipt", entityId: receiptId });
  revalidateDelivery(receiptId, data.client_id);
}

/** Descarta un borrador (se borra de verdad; solo borradores). */
export async function discardDeliveryAction(receiptId: string): Promise<void> {
  await requirePermission("deliveries.create");
  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("delivery_receipts")
    .delete()
    .eq("id", receiptId)
    .eq("status", "DRAFT")
    .select("number, client_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solo se puede descartar un acuse en borrador.");
  await logAudit({ companyId, action: "DELETE", entityType: "delivery_receipt", entityId: receiptId, oldValues: { number: data.number } });
  revalidatePath("/deliveries");
  revalidatePath(`/clients/${data.client_id}`);
  redirect("/deliveries");
}

/** Copia el acuse (encabezado y líneas) en un borrador nuevo con fecha de hoy. */
export async function duplicateDeliveryAction(receiptId: string): Promise<void> {
  await requirePermission("deliveries.create");
  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const [{ data: src, error }, { data: items }] = await Promise.all([
    supabase.from("delivery_receipts").select("*").eq("id", receiptId).single(),
    supabase.from("delivery_receipt_items").select("description, reference, quantity, position").eq("receipt_id", receiptId).order("position"),
  ]);
  if (error || !src) throw new Error(error?.message ?? "Acuse no encontrado.");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const number = await generateDeliveryNumber(companyId);
  const { data: created, error: insError } = await supabase
    .from("delivery_receipts")
    .insert({
      company_id: companyId,
      number,
      client_id: src.client_id,
      project_id: src.project_id,
      delivery_type: src.delivery_type,
      subtitle: src.subtitle,
      delivery_date: new Date().toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" }),
      place: src.place,
      recipient_name: src.recipient_name,
      recipient_short_name: src.recipient_short_name,
      recipient_department: src.recipient_department,
      reference: src.reference,
      intro_text: src.intro_text,
      notes: src.notes,
      copies: src.copies,
      delivered_by_name: src.delivered_by_name,
      delivered_by_id_number: src.delivered_by_id_number,
      duplicated_from_id: src.id,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (insError || !created) throw new Error(insError?.message ?? "No se pudo duplicar.");
  if (items && items.length > 0) {
    const { error: itemsError } = await supabase.from("delivery_receipt_items").insert(
      items.map((i) => ({
        company_id: companyId,
        receipt_id: created.id,
        position: i.position,
        description: i.description,
        reference: i.reference,
        quantity: i.quantity,
      })),
    );
    if (itemsError) throw new Error(itemsError.message);
  }
  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "delivery_receipt",
    entityId: created.id,
    newValues: { number, duplicated_from: src.number },
  });
  revalidateDelivery(created.id, src.client_id);
  redirect(`/deliveries/${created.id}`);
}

/**
 * Adjunta el acuse firmado (PDF o foto/escaneo). Se guarda en `documents`
 * (entity_type = delivery_receipt) y el acuse pasa a "Firmado". Se puede
 * subir más de uno (ej. una copia más legible); los anteriores se conservan.
 */
export async function uploadSignedDeliveryAction(
  receiptId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("deliveries.create");
  await requirePermission("documents.upload");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona el archivo del acuse firmado." };
  if (file.size > MAX_SIGNED_SIZE) return { error: "El archivo no puede superar 15MB." };
  const okType = file.type === "application/pdf" || file.type.startsWith("image/");
  if (!okType) return { error: "Sube el acuse firmado como PDF o como foto (JPG, PNG)." };

  const extra = signedUploadSchema.safeParse({
    received_by_name: String(formData.get("received_by_name") ?? ""),
    received_by_position: String(formData.get("received_by_position") ?? ""),
    received_at: String(formData.get("received_at") ?? ""),
  });
  if (!extra.success) return { error: extra.error.issues[0]?.message ?? "Datos inválidos." };

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const { data: receipt } = await supabase
    .from("delivery_receipts")
    .select("id, number, status, client_id, issued_at")
    .eq("id", receiptId)
    .single();
  if (!receipt) return { error: "Acuse no encontrado." };
  if (receipt.status === "CANCELLED") return { error: "Este acuse está anulado." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ext = (file.name.split(".").pop() ?? "pdf").replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "pdf";
  const path = `${companyId}/delivery_receipt/${receiptId}/${Date.now()}-${receipt.number}-firmado.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upError } = await supabase.storage
    .from("documents")
    .upload(path, buffer, { contentType: file.type || "application/octet-stream" });
  if (upError) return { error: upError.message };

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      company_id: companyId,
      entity_type: "delivery_receipt",
      entity_id: receiptId,
      file_name: `${receipt.number} firmado - ${file.name}`,
      storage_path: path,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      uploaded_by: user?.id,
    })
    .select("id")
    .single();
  if (docError) {
    await supabase.storage.from("documents").remove([path]);
    return { error: docError.message };
  }

  const now = new Date().toISOString();
  const receivedAt = extra.data.received_at ? new Date(extra.data.received_at).toISOString() : null;
  const { error: updError } = await supabase
    .from("delivery_receipts")
    .update({
      status: "SIGNED",
      signed_at: now,
      signed_by: user?.id ?? null,
      issued_at: receipt.issued_at ?? now,
      ...(extra.data.received_by_name ? { received_by_name: extra.data.received_by_name } : {}),
      ...(extra.data.received_by_position ? { received_by_position: extra.data.received_by_position } : {}),
      ...(receivedAt ? { received_at: receivedAt } : {}),
    })
    .eq("id", receiptId);
  if (updError) return { error: updError.message };

  await logAudit({
    companyId,
    action: "SIGN",
    entityType: "delivery_receipt",
    entityId: receiptId,
    newValues: { document_id: doc.id, file_name: file.name, ...extra.data },
  });

  revalidateDelivery(receiptId, receipt.client_id);
  return {
    error: null,
    success: `Acuse firmado adjuntado. ${receipt.number} quedó como Firmado.`,
    successId: Date.now(),
  };
}

/** Datos para armar el PDF en el navegador (ver lib/pdf/delivery-receipt-document.tsx). */
export async function getDeliveryPdfDataAction(
  receiptId: string,
): Promise<{ data: DeliveryReceiptPdfData | null; error: string | null }> {
  await requirePermission("deliveries.view");
  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const [{ data: receipt, error }, { data: items }, { data: company }] = await Promise.all([
    supabase.from("delivery_receipts").select("*").eq("id", receiptId).single(),
    supabase
      .from("delivery_receipt_items")
      .select("description, reference, quantity")
      .eq("receipt_id", receiptId)
      .order("position"),
    supabase
      .from("companies")
      .select("name, legal_name, tax_id, logo_url, brand_primary, brand_accent, address, phone, email")
      .eq("id", companyId)
      .single(),
  ]);
  if (error || !receipt) return { data: null, error: error?.message ?? "Acuse no encontrado." };

  return {
    data: {
      company: {
        name: company?.name ?? "Mindfreak Events",
        legal_name: company?.legal_name ?? null,
        tax_id: company?.tax_id ?? null,
        logo_url: company?.logo_url ?? null,
        brand_primary: company?.brand_primary || "#0b0e14",
        brand_accent: company?.brand_accent || "#17a6b8",
        address: company?.address ?? null,
        phone: company?.phone ?? null,
        email: company?.email ?? null,
      },
      receipt: {
        number: receipt.number,
        status: receipt.status,
        delivery_type: receipt.delivery_type,
        subtitle: receipt.subtitle,
        delivery_date: receipt.delivery_date,
        place: receipt.place,
        recipient_name: receipt.recipient_name,
        recipient_short_name: receipt.recipient_short_name,
        recipient_department: receipt.recipient_department,
        reference: receipt.reference,
        intro_text: receipt.intro_text,
        notes: receipt.notes,
        copies: receipt.copies,
        delivered_by_name: receipt.delivered_by_name,
        delivered_by_id_number: receipt.delivered_by_id_number,
      },
      items: (items ?? []).map((i) => ({
        description: i.description,
        reference: i.reference,
        quantity: Number(i.quantity),
      })),
    },
    error: null,
  };
}
