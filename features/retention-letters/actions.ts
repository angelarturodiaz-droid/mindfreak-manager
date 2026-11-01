"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserCompanyIds, hasPermission } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import {
  DEFAULT_LEGAL_TEXT,
  retentionLetterErrorMessage,
  retentionPercents,
  type LetterAddressee,
  type RetentionLetterData,
} from "./schema";

async function companyId(): Promise<string> {
  const ids = await getCurrentUserCompanyIds();
  if (!ids.length) throw new Error("Tu usuario no está asignado a ninguna compañía.");
  return ids[0];
}

export type RetentionLetterSettings = {
  addressee_name: string;
  addressee_title: string;
  legal_text: string;
  signer_name: string | null;
  signer_title: string | null;
};

export async function getRetentionLetterSettings(): Promise<RetentionLetterSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("retention_letter_settings")
    .select("addressee_name, addressee_title, legal_text, signer_name, signer_title")
    .eq("company_id", await companyId())
    .maybeSingle();
  return (
    data ?? {
      addressee_name: "",
      addressee_title: "Director General",
      legal_text: DEFAULT_LEGAL_TEXT,
      signer_name: null,
      signer_title: null,
    }
  );
}

export type SettingsState = { error: string | null; ok?: boolean };

/** Configuración → Documentos → Carta de retención. */
export async function updateRetentionLetterSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  if (!(await hasPermission("settings.manage"))) return { error: "Solo Administración puede cambiar esta configuración." };
  const values = {
    addressee_name: String(formData.get("addressee_name") ?? "").trim(),
    addressee_title: String(formData.get("addressee_title") ?? "").trim() || "Director General",
    legal_text: String(formData.get("legal_text") ?? "").trim() || DEFAULT_LEGAL_TEXT,
    signer_name: String(formData.get("signer_name") ?? "").trim() || null,
    signer_title: String(formData.get("signer_title") ?? "").trim() || null,
  };
  if (!values.addressee_name) return { error: "Escribe el nombre del Director(a) General de la DGII." };
  const supabase = await createClient();
  const cid = await companyId();
  const before = await getRetentionLetterSettings();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("retention_letter_settings")
    .upsert({ company_id: cid, ...values, updated_by: user?.id ?? null, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  await logAudit({ companyId: cid, action: "UPDATE", entityType: "retention_letter_settings", entityId: cid, oldValues: before, newValues: values });
  revalidatePath("/settings/documents");
  return { error: null, ok: true };
}

/**
 * Datos de la carta de un gasto. Asigna el número CR la primera vez (o
 * devuelve el que ya tiene). Lee todo del gasto: no recalcula impuestos.
 */
export async function getRetentionLetterDataAction(
  expenseId: string,
  options: { letterDate: string; addressee: LetterAddressee; signerName: string; signerTitle: string },
): Promise<{ data: RetentionLetterData | null; error: string | null }> {
  if (!(await hasPermission("payments.create"))) return { data: null, error: "No tienes permiso para emitir cartas de retención." };
  const supabase = await createClient();
  const { data: number, error: numError } = await supabase.rpc("assign_retention_letter_number", { p_expense_id: expenseId });
  if (numError) return { data: null, error: retentionLetterErrorMessage(numError.message) };

  const cid = await companyId();
  const [{ data: e, error }, { data: company }, { data: payments }, settings] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, description, expense_date, ncf, subtotal, tax, total, currency, isr_withheld, itbis_withheld, incentive_recipient, suppliers(name, tax_id)")
      .eq("id", expenseId)
      .single(),
    supabase
      .from("companies")
      .select("name, legal_name, tax_id, address, phone, logo_url, brand_primary, brand_accent")
      .eq("id", cid)
      .single(),
    supabase
      .from("supplier_payments")
      .select("payment_date, amount")
      .eq("expense_id", expenseId)
      .eq("status", "ACTIVE")
      .order("payment_date", { ascending: true }),
    getRetentionLetterSettings(),
  ]);
  if (error || !e) return { data: null, error: error?.message ?? "Gasto no encontrado." };

  const sup = (Array.isArray(e.suppliers) ? e.suppliers[0] : e.suppliers) as { name: string; tax_id: string | null } | null;
  const supplier = { name: sup?.name ?? e.incentive_recipient ?? "Proveedor", tax_id: sup?.tax_id ?? null };
  const pays = payments ?? [];
  const subtotal = Number(e.subtotal ?? 0);
  const tax = Number(e.tax ?? 0);
  const isr = Number(e.isr_withheld ?? 0);
  const itbis = Number(e.itbis_withheld ?? 0);
  const { itbisPct, isrPct } = retentionPercents({ subtotal, tax, isrWithheld: isr, itbisWithheld: itbis });

  const data: RetentionLetterData = {
    company: company ?? {
      name: "Mindfreak Events",
      legal_name: null,
      tax_id: null,
      address: null,
      phone: null,
      logo_url: null,
      brand_primary: "#000000",
      brand_accent: "#17a6b8",
    },
    number: number as string,
    letterDate: options.letterDate,
    addressee:
      options.addressee === "DGII"
        ? { mode: "DGII", name: settings.addressee_name, title: settings.addressee_title }
        : options.addressee === "SUPPLIER"
          ? { mode: "SUPPLIER", name: supplier.name, title: null }
          : { mode: "WHOM", name: null, title: null },
    supplier,
    rows: [
      {
        invoiceDate: e.expense_date,
        ncf: e.ncf ?? null,
        total: Number(e.total ?? 0),
        tax,
        // Fecha de retención = fecha del (primer) pago al proveedor.
        retentionDate: pays[0]?.payment_date ?? e.expense_date,
        itbisWithheld: itbis,
        isrWithheld: isr,
        netPaid: pays.reduce((acc, p) => acc + Number(p.amount), 0),
      },
    ],
    currency: e.currency ?? "DOP",
    itbisPct,
    isrPct,
    legalText: settings.legal_text || DEFAULT_LEGAL_TEXT,
    signer: { name: options.signerName.trim() || settings.signer_name, title: options.signerTitle.trim() || settings.signer_title },
    expenseDescription: e.description,
  };
  return { data, error: null };
}

/** Sube el PDF (armado en el navegador) a los documentos del gasto y devuelve un link. */
export async function uploadRetentionLetterAction(
  expenseId: string,
  number: string,
  pdfBase64: string,
): Promise<{ url: string | null; error: string | null }> {
  if (!(await hasPermission("payments.create"))) return { url: null, error: "No tienes permiso." };
  const supabase = await createClient();
  const cid = await companyId();
  const fileName = `Carta de retención ${number}.pdf`;
  const path = `${cid}/expense/${expenseId}/carta-retencion-${number}.pdf`;
  const buffer = Buffer.from(pdfBase64, "base64");
  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });
  if (upErr) return { url: null, error: upErr.message };

  // Queda en «Documentos» del gasto (una sola vez por número; si se regenera, se reemplaza el archivo).
  const { data: existing } = await supabase.from("documents").select("id").eq("storage_path", path).maybeSingle();
  if (!existing) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("documents").insert({
      company_id: cid,
      entity_type: "expense",
      entity_id: expenseId,
      file_name: fileName,
      storage_path: path,
      mime_type: "application/pdf",
      size_bytes: buffer.length,
      uploaded_by: user?.id,
    });
  }
  const { data: signed, error } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error || !signed) return { url: null, error: error?.message ?? "No se pudo generar el link." };
  revalidatePath(`/expenses/${expenseId}`);
  return { url: signed.signedUrl, error: null };
}
