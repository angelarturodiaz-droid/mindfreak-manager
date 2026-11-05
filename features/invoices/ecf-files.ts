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
