"use server";

/**
 * 5b (ajuste 4-nov) — El e-CF que genera el Facturador Gratuito de la DGII (PDF y XML) se adjunta a la factura
 * del ERP para que los dos sistemas queden iguales. Se guarda en `documents` con entity_type 'invoice_ecf'
 * (no se puede borrar: migración 100). Si se sube uno equivocado, se sube otro y vale el más reciente.
 */
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUserCompanyIds, hasPermission, requirePermission } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { ecfFileKind, type EcfFileKind } from "./ecf-file-kind";

export type EcfFileState = { error: string | null; success?: string; successId?: number };

const MAX_SIZE = 15 * 1024 * 1024;

async function companyId(): Promise<string> {
  const ids = await getCurrentUserCompanyIds();
  if (!ids.length) throw new Error("Tu usuario no está asignado a ninguna compañía.");
  return ids[0];
}

export async function attachEcfFileAction(invoiceId: string, _prev: EcfFileState, formData: FormData): Promise<EcfFileState> {
  await requirePermission("invoices.create");
  if (!(await hasPermission("documents.upload"))) return { error: "Tu rol no puede subir documentos." };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Elige el PDF y/o el XML que te dio el Facturador de la DGII." };

  const supabase = await createSupabaseClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, number, billing_type, status, e_ncf")
    .eq("id", invoiceId)
    .single();
  if (!invoice) return { error: "No se encontró la factura." };
  if (invoice.billing_type !== "ELECTRONIC") return { error: "Solo las facturas electrónicas llevan el e-CF de la DGII." };
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED")
    return { error: "Primero emite la factura en el sistema (no puede estar en Borrador ni cancelada)." };
  if (!invoice.e_ncf) return { error: "Primero anota el e-NCF que te dio el Facturador (arriba, en esta misma tarjeta)." };

  // Validar todos antes de subir ninguno.
  const checked: { file: File; kind: EcfFileKind }[] = [];
  for (const file of files) {
    const kind = ecfFileKind(file.name, file.type);
    if (!kind) return { error: `«${file.name}» no es PDF ni XML. Sube el PDF y/o el XML que genera el Facturador.` };
    if (file.size > MAX_SIZE) return { error: `«${file.name}» pesa más de 15 MB.` };
    if (kind === "xml") {
      const text = await file.text();
      if (!text.includes(invoice.e_ncf)) {
        return {
          error: `El XML «${file.name}» no menciona el e-NCF ${invoice.e_ncf} de esta factura. Revisa que sea el de esta factura.`,
        };
      }
    }
    checked.push({ file, kind });
  }

  const company = await companyId();
  const { data: { user } } = await supabase.auth.getUser();
  const saved: string[] = [];
  for (const { file, kind } of checked) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${company}/invoice_ecf/${invoiceId}/${Date.now()}-${safe}`;
    const contentType = kind === "pdf" ? "application/pdf" : "application/xml";
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType });
    if (upErr) return { error: `No se pudo subir «${file.name}»: ${upErr.message}` };
    const { data: doc, error } = await supabase
      .from("documents")
      .insert({
        company_id: company,
        entity_type: "invoice_ecf",
        entity_id: invoiceId,
        file_name: file.name,
        storage_path: path,
        mime_type: contentType,
        size_bytes: file.size,
        uploaded_by: user?.id,
      })
      .select("id")
      .single();
    if (error || !doc) return { error: `No se pudo registrar «${file.name}»: ${error?.message ?? ""}` };
    await logAudit({
      companyId: company,
      action: "ECF_ATTACH",
      entityType: "invoice",
      entityId: invoiceId,
      newValues: { e_ncf: invoice.e_ncf, archivo: file.name, tipo: kind.toUpperCase(), document_id: doc.id },
    });
    saved.push(kind.toUpperCase());
  }

  revalidatePath(`/invoices/${invoiceId}`);
  return {
    error: null,
    success: `e-CF de la DGII adjuntado (${saved.join(" y ")}).`,
    successId: Date.now(),
  };
}

/** Enlace (7 días) al PDF del e-CF de la DGII más reciente, para enviarlo al cliente. */
export async function getEcfShareLinkAction(invoiceId: string): Promise<{ url: string | null; error: string | null }> {
  await requirePermission("invoices.view");
  const supabase = await createSupabaseClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("entity_type", "invoice_ecf")
    .eq("entity_id", invoiceId)
    .eq("mime_type", "application/pdf")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!doc) return { url: null, error: "Esta factura todavía no tiene el PDF del e-CF de la DGII adjunto." };
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 60 * 60 * 24 * 7);
  if (error || !data) return { url: null, error: error?.message ?? "No se pudo generar el enlace." };
  return { url: data.signedUrl, error: null };
}

const CORRECTION_ERRORS: Record<string, string> = {
  ecf_correct_forbidden: "Solo Administración puede corregir los datos del e-CF.",
  ecf_correct_reason: "Escribe el motivo de la corrección (mínimo 10 letras).",
  ecf_correct_not_applicable: "La factura no es electrónica o todavía no tiene e-NCF anotado.",
  ecf_correct_format: "El e-NCF debe ser una E seguida de 12 números (ej. E310000000371).",
};

/**
 * 6-nov: corregir los datos del e-CF anotados por un error de tipeo (el e-CF de la DGII está bien).
 * Solo Administración (invoices.ecf_correct), con motivo; queda en la Auditoría con el antes y el después.
 * Si ya hay un XML de la DGII adjunto, el e-NCF nuevo tiene que ser el de ese XML.
 */
export async function correctEcfDataAction(invoiceId: string, _prev: EcfFileState, formData: FormData): Promise<EcfFileState> {
  if (!(await hasPermission("invoices.ecf_correct"))) return { error: CORRECTION_ERRORS.ecf_correct_forbidden };

  const eNcf = String(formData.get("e_ncf") ?? "").trim().toUpperCase();
  const code = String(formData.get("security_code") ?? "").trim();
  const signature = String(formData.get("digital_signature_at") ?? "").trim();
  const validUntil = String(formData.get("e_ncf_valid_until") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 10) return { error: CORRECTION_ERRORS.ecf_correct_reason };
  if (!/^E\d{12}$/.test(eNcf)) return { error: CORRECTION_ERRORS.ecf_correct_format };

  const supabase = await createSupabaseClient();
  const { data: before } = await supabase
    .from("invoices")
    .select("number, e_ncf, security_code, digital_signature_at, e_ncf_valid_until")
    .eq("id", invoiceId)
    .single();
  if (!before) return { error: "No se encontró la factura." };

  // Con el XML de la DGII ya adjunto, el e-NCF corregido tiene que coincidir con él.
  const { data: xml } = await supabase
    .from("documents")
    .select("storage_path, file_name")
    .eq("entity_type", "invoice_ecf")
    .eq("entity_id", invoiceId)
    .eq("mime_type", "application/xml")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (xml) {
    const { data: blob } = await supabase.storage.from("documents").download(xml.storage_path);
    const text = blob ? await blob.text() : "";
    if (text && !text.includes(eNcf)) {
      return { error: `El XML de la DGII adjunto («${xml.file_name}») no tiene el e-NCF ${eNcf}. Revisa el número o adjunta el XML correcto.` };
    }
  }

  const { error } = await supabase.rpc("correct_invoice_ecf", {
    p_invoice_id: invoiceId,
    p_e_ncf: eNcf,
    p_security_code: code,
    p_signature_at: signature ? new Date(`${signature}:00-04:00`).toISOString() : null,
    p_valid_until: validUntil || null,
    p_reason: reason,
  });
  if (error) {
    const key = Object.keys(CORRECTION_ERRORS).find((k) => error.message.includes(k));
    if (key) return { error: CORRECTION_ERRORS[key] };
    const m = error.message.match(/ecf_correct_type: (.*)/);
    return { error: m ? m[1] : error.message };
  }

  await logAudit({
    companyId: await companyId(),
    action: "ECF_CORRECT",
    entityType: "invoice",
    entityId: invoiceId,
    oldValues: {
      e_ncf: before.e_ncf,
      security_code: before.security_code,
      digital_signature_at: before.digital_signature_at,
      e_ncf_valid_until: before.e_ncf_valid_until,
    },
    newValues: { e_ncf: eNcf, security_code: code || null, digital_signature_at: signature || null, e_ncf_valid_until: validUntil || null, motivo: reason },
  });
  revalidatePath(`/invoices/${invoiceId}`);
  return { error: null, success: `Datos del e-CF corregidos (${eNcf}).`, successId: Date.now() };
}
