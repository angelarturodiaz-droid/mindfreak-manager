"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import {
  invoiceHeaderSchema,
  invoiceItemSchema,
  calculateInvoiceItemSubtotal,
  calculateInvoiceTotals,
} from "./schema";
import type { InvoicePdfData } from "@/lib/pdf/invoice-document";
import type { InvoiceElectronicPdfData } from "@/lib/pdf/invoice-electronic-document";

export type ActionState = { error: string | null };

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

/**
 * Antes usaba count(*)+1 — se rompía apenas había un hueco en la
 * numeración (ej. una factura borrada). Ahora toma el máximo real de los
 * números existentes (parseado en JS, no depende del orden lexicográfico
 * del texto).
 */
async function generateInvoiceNumber(companyId: string): Promise<string> {
  const supabase = await createSupabaseClient();
  const { data } = await supabase.from("invoices").select("number").eq("company_id", companyId);
  const maxNum = (data ?? []).reduce((max, row) => {
    const n = parseInt(row.number.replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `INV-${String(maxNum + 1).padStart(4, "0")}`;
}

async function recalculateInvoiceTotals(invoiceId: string) {
  const supabase = await createSupabaseClient();
  const [{ data: items, error }, { data: invoice }] = await Promise.all([
    supabase
      .from("invoice_items")
      .select("quantity, unit_price, discount, tax")
      .eq("invoice_id", invoiceId),
    supabase.from("invoices").select("paid_amount, commission_percent").eq("id", invoiceId).single(),
  ]);
  if (error) throw new Error(error.message);

  const totals = calculateInvoiceTotals(items ?? [], invoice?.commission_percent ?? 0);
  const paidAmount = invoice?.paid_amount ?? 0;

  const { error: updateError } = await supabase
    .from("invoices")
    .update({ ...totals, balance: Math.max(0, totals.total - paidAmount) })
    .eq("id", invoiceId);
  if (updateError) throw new Error(updateError.message);
}

export async function createInvoiceAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("invoices.create");

  const parsed = invoiceHeaderSchema.safeParse({
    client_id: String(formData.get("client_id") ?? ""),
    project_id: String(formData.get("project_id") ?? ""),
    issue_date: String(formData.get("issue_date") ?? ""),
    due_date: String(formData.get("due_date") ?? ""),
    payment_terms_id: String(formData.get("payment_terms_id") ?? ""),
    commission_percent: String(formData.get("commission_percent") ?? "0"),
    currency: String(formData.get("currency") ?? "DOP"),
    exchange_rate: String(formData.get("exchange_rate") ?? "1"),
    billing_type: String(formData.get("billing_type") ?? "REGULAR"),
    ncf: String(formData.get("ncf") ?? ""),
    ncf_type: String(formData.get("ncf_type") ?? ""),
    e_ncf: String(formData.get("e_ncf") ?? ""),
    e_ncf_valid_until: String(formData.get("e_ncf_valid_until") ?? ""),
    payment_type_code: String(formData.get("payment_type_code") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createSupabaseClient();
  let clientId = parsed.data.client_id || null;
  let quotationId: string | null = null;
  // "Cuando una cotización sea aceptada, la condición de pago debe pasar
  // automáticamente al proceso de facturación": si la factura viene de un
  // proyecto que a su vez viene de una cotización con condición de pago,
  // se hereda de ahí por defecto (a menos que se elija otra explícitamente
  // en el formulario).
  let inheritedPaymentTermsId: string | null = null;

  if (parsed.data.project_id) {
    const { data: project, error: projError } = await supabase
      .from("projects")
      .select("client_id, quotation_id, quotations(payment_terms_id)")
      .eq("id", parsed.data.project_id)
      .single();
    if (projError || !project) return { error: "Proyecto no encontrado." };
    clientId = project.client_id;
    quotationId = project.quotation_id;
    const quotationData = project.quotations as
      | { payment_terms_id: string | null }
      | { payment_terms_id: string | null }[]
      | null;
    const quotation = Array.isArray(quotationData) ? quotationData[0] : quotationData;
    inheritedPaymentTermsId = quotation?.payment_terms_id ?? null;
  }

  if (!clientId) {
    return { error: "Selecciona un cliente o un proyecto." };
  }

  const companyId = await getPrimaryCompanyId();
  const number = await generateInvoiceNumber(companyId);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Se "congela" credit_days en la factura (el trigger de la base de datos
  // calcula due_date = issue_date + credit_days automáticamente). Si no
  // hay condición de pago (ni elegida ni heredada), due_date se guarda tal
  // cual se escribió a mano.
  const effectivePaymentTermsId = parsed.data.payment_terms_id || inheritedPaymentTermsId;
  let creditDays: number | null = null;
  if (effectivePaymentTermsId) {
    const { data: term, error: termError } = await supabase
      .from("payment_terms")
      .select("credit_days")
      .eq("id", effectivePaymentTermsId)
      .single();
    if (termError || !term) return { error: "La condición de pago seleccionada no es válida." };
    creditDays = term.credit_days;
  }

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      company_id: companyId,
      client_id: clientId,
      project_id: parsed.data.project_id || null,
      quotation_id: quotationId,
      number,
      issue_date: parsed.data.issue_date,
      due_date: parsed.data.due_date || null,
      payment_terms_id: effectivePaymentTermsId || null,
      credit_days: creditDays,
      commission_percent: parsed.data.commission_percent,
      currency: parsed.data.currency,
      exchange_rate: parsed.data.exchange_rate,
      billing_type: parsed.data.billing_type,
      ncf: parsed.data.ncf || null,
      ncf_type: parsed.data.ncf_type || null,
      e_ncf: parsed.data.e_ncf || null,
      e_ncf_valid_until: parsed.data.e_ncf_valid_until || null,
      payment_type_code: parsed.data.payment_type_code || null,
      status: "DRAFT",
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "invoice",
    entityId: data.id,
    newValues: parsed.data,
  });

  revalidatePath("/invoices");
  redirect(`/invoices/${data.id}`);
}

export async function updateInvoiceHeaderAction(
  invoiceId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("invoices.create"); // no hay invoices.update dedicado (ver F4)

  const dueDate = String(formData.get("due_date") ?? "");
  const paymentTermsId = String(formData.get("payment_terms_id") ?? "");
  const billingType = String(formData.get("billing_type") ?? "REGULAR");
  const ncf = String(formData.get("ncf") ?? "");
  const ncfType = String(formData.get("ncf_type") ?? "");
  const eNcf = String(formData.get("e_ncf") ?? "");
  const eNcfValidUntil = String(formData.get("e_ncf_valid_until") ?? "");
  const paymentTypeCode = String(formData.get("payment_type_code") ?? "");

  const supabase = await createSupabaseClient();

  let creditDays: number | null = null;
  if (paymentTermsId) {
    const { data: term, error: termError } = await supabase
      .from("payment_terms")
      .select("credit_days")
      .eq("id", paymentTermsId)
      .single();
    if (termError || !term) return { error: "La condición de pago seleccionada no es válida." };
    creditDays = term.credit_days;
  }

  const { error } = await supabase
    .from("invoices")
    .update({
      // Si hay condición de pago, due_date la recalcula el trigger de la
      // base de datos — el valor que se manda aquí solo aplica si no hay
      // condición seleccionada.
      due_date: dueDate || null,
      payment_terms_id: paymentTermsId || null,
      credit_days: creditDays,
      billing_type: billingType,
      ncf: ncf || null,
      ncf_type: ncfType || null,
      e_ncf: eNcf || null,
      e_ncf_valid_until: eNcfValidUntil || null,
      payment_type_code: paymentTypeCode || null,
    })
    .eq("id", invoiceId);

  if (error) return { error: error.message };

  revalidatePath(`/invoices/${invoiceId}`);
  return { error: null };
}

export async function addInvoiceItemAction(
  invoiceId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("invoices.create");

  const parsed = invoiceItemSchema.safeParse({
    service_id: String(formData.get("service_id") ?? ""),
    description: String(formData.get("description") ?? ""),
    quantity: String(formData.get("quantity") ?? "1"),
    unit_price: String(formData.get("unit_price") ?? "0"),
    discount: String(formData.get("discount") ?? "0"),
    tax_percent: String(formData.get("tax_percent") ?? "0"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createSupabaseClient();

  const base = parsed.data.quantity * parsed.data.unit_price - parsed.data.discount;
  const tax = Math.round(Math.max(0, base) * (parsed.data.tax_percent / 100) * 100) / 100;

  // tax_rate_id: referencia de mejor esfuerzo al catálogo de Impuestos —
  // NO participa en el cálculo del ITBIS (eso sigue siendo tax_percent,
  // sin cambios). Si el % elegido coincide con una tasa activa del
  // catálogo, se deja la referencia; si no coincide con ninguna (ej. un %
  // personalizado), se deja en null en vez de inventar un vínculo falso.
  const companyId = await getPrimaryCompanyId();
  const { data: matchingTaxRate } = await supabase
    .from("tax_rates")
    .select("id")
    .eq("company_id", companyId)
    .eq("rate", parsed.data.tax_percent)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const subtotal = calculateInvoiceItemSubtotal({ ...parsed.data, tax });
  const { error } = await supabase.from("invoice_items").insert({
    invoice_id: invoiceId,
    service_id: parsed.data.service_id || null,
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    unit_price: parsed.data.unit_price,
    discount: parsed.data.discount,
    tax,
    subtotal,
    tax_rate_id: matchingTaxRate?.id ?? null,
  });

  if (error) return { error: error.message };

  await recalculateInvoiceTotals(invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
  return { error: null };
}

export async function deleteInvoiceItemAction(
  itemId: string,
  invoiceId: string,
): Promise<void> {
  await requirePermission("invoices.create");
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("invoice_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);

  await recalculateInvoiceTotals(invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function issueInvoiceAction(invoiceId: string): Promise<void> {
  await requirePermission("invoices.create");
  const supabase = await createSupabaseClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("subtotal, total")
    .eq("id", invoiceId)
    .single();
  if (!invoice || invoice.total <= 0) {
    throw new Error("La factura necesita al menos una línea antes de emitirse.");
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "ISSUED" })
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "STATUS_ISSUED",
    entityType: "invoice",
    entityId: invoiceId,
    newValues: { status: "ISSUED" },
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
}

export async function cancelInvoiceAction(invoiceId: string): Promise<void> {
  await requirePermission("invoices.create");
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status: "CANCELLED" })
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "STATUS_CANCELLED",
    entityType: "invoice",
    entityId: invoiceId,
    newValues: { status: "CANCELLED" },
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
}

/**
 * Obtiene los datos necesarios para renderizar el PDF de la factura. El
 * render en sí (`pdf()` de @react-pdf/renderer) se hace en el navegador —
 * Cloudflare Workers no soporta la compilación WASM dinámica que usa
 * yoga-layout para el layout del PDF. Ver conversación con el usuario:
 * se decidió mover la generación de PDF fuera de Cloudflare (cliente).
 */
export type InvoicePdfPayload =
  | { billingType: "ELECTRONIC"; data: InvoiceElectronicPdfData }
  | { billingType: "STANDARD"; data: InvoicePdfData };

export async function getInvoicePdfDataAction(
  invoiceId: string,
): Promise<{ payload: InvoicePdfPayload | null; error: string | null }> {
  await requirePermission("invoices.view");

  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  const [{ data: invoice, error: iError }, { data: items, error: itError }, { data: company }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("*, clients(name, tax_id, email, phone), payment_terms(name), projects(number, name)")
        .eq("id", invoiceId)
        .single(),
      supabase
        .from("invoice_items")
        .select("description, quantity, unit_price, discount, subtotal")
        .eq("invoice_id", invoiceId)
        .order("sort_order"),
      supabase
        .from("companies")
        .select("name, legal_name, tax_id, address, phone, logo_url, brand_primary, brand_accent")
        .eq("id", companyId)
        .single(),
    ]);

  if (iError || !invoice) return { payload: null, error: iError?.message ?? "Factura no encontrada." };
  if (itError) return { payload: null, error: itError.message };

  const clientData = invoice.clients as
    | { name: string; tax_id: string | null; email: string | null; phone: string | null }
    | { name: string; tax_id: string | null; email: string | null; phone: string | null }[]
    | null;
  const clientRecord = Array.isArray(clientData) ? clientData[0] : clientData;

  const paymentTermsData = invoice.payment_terms as { name: string } | { name: string }[] | null;
  const paymentTermsName = Array.isArray(paymentTermsData) ? paymentTermsData[0]?.name : paymentTermsData?.name;

  const projectData = invoice.projects as
    | { number: string; name: string }
    | { number: string; name: string }[]
    | null;
  const projectRecord = Array.isArray(projectData) ? projectData[0] : projectData;

  const commonCompany = company ?? {
    name: "Mindfreak Manager",
    legal_name: null,
    tax_id: null,
    address: null,
    phone: null,
    logo_url: null,
    brand_primary: "#0b0e14",
    brand_accent: "#17a6b8",
  };
  const commonClient = {
    name: clientRecord?.name ?? "Cliente",
    tax_id: clientRecord?.tax_id ?? null,
    email: clientRecord?.email ?? null,
    phone: clientRecord?.phone ?? null,
  };

  if (invoice.billing_type === "ELECTRONIC") {
    return {
      payload: {
        billingType: "ELECTRONIC",
        data: {
          company: commonCompany,
          invoice,
          client: commonClient,
          project: projectRecord ?? null,
          items: items ?? [],
        },
      },
      error: null,
    };
  }

  return {
    payload: {
      billingType: "STANDARD",
      data: {
        company: commonCompany,
        invoice: { ...invoice, payment_terms_name: paymentTermsName ?? null },
        client: commonClient,
        items: items ?? [],
      },
    },
    error: null,
  };
}

/**
 * Sube el PDF de la factura (ya renderizado en el navegador) a Storage,
 * registra/actualiza el documento en la tabla `documents` y devuelve una
 * URL firmada (7 días) para compartir.
 */
export async function uploadInvoicePdfAction(
  invoiceId: string,
  pdfBase64: string,
): Promise<{ url: string | null; error: string | null }> {
  await requirePermission("invoices.view");

  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  const { data: invoice, error: iError } = await supabase
    .from("invoices")
    .select("number")
    .eq("id", invoiceId)
    .single();

  if (iError || !invoice) return { url: null, error: iError?.message ?? "Factura no encontrada." };

  const buffer = Buffer.from(pdfBase64, "base64");

  const path = `${companyId}/invoices/${invoiceId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });

  if (uploadError) return { url: null, error: uploadError.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existingDoc } = await supabase
    .from("documents")
    .select("id")
    .eq("entity_type", "invoice")
    .eq("entity_id", invoiceId)
    .maybeSingle();

  const docRow = {
    company_id: companyId,
    entity_type: "invoice",
    entity_id: invoiceId,
    file_name: `${invoice.number}.pdf`,
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
    .createSignedUrl(path, 60 * 60 * 24 * 7);

  if (signError || !signed) {
    return { url: null, error: signError?.message ?? "No se pudo generar el link." };
  }

  return { url: signed.signedUrl, error: null };
}

/**
 * Duplica una factura existente:/**
 * Duplica una factura existente: crea una nueva factura en BORRADOR con el
 * mismo cliente/proyecto y copia todas las líneas (servicio, cantidad,
 * precio, descuento, impuesto) de la original. La factura original nunca se
 * toca — permite corregir cantidades sin reescribir todo ni editar un
 * documento ya emitido. Confirmado con el usuario (ver conversación).
 */
export async function duplicateInvoiceAction(invoiceId: string): Promise<void> {
  await requirePermission("invoices.create");
  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  const { data: original, error: origError } = await supabase
    .from("invoices")
    .select(
      "client_id, project_id, quotation_id, currency, exchange_rate, ncf_type",
    )
    .eq("id", invoiceId)
    .single();
  if (origError || !original) throw new Error(origError?.message ?? "Factura no encontrada.");

  const { data: items, error: itemsError } = await supabase
    .from("invoice_items")
    .select("service_id, description, quantity, unit_price, discount, tax, tax_rate_id, subtotal")
    .eq("invoice_id", invoiceId)
    .order("sort_order");
  if (itemsError) throw new Error(itemsError.message);

  const number = await generateInvoiceNumber(companyId);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: newInvoice, error: createError } = await supabase
    .from("invoices")
    .insert({
      company_id: companyId,
      client_id: original.client_id,
      project_id: original.project_id,
      quotation_id: original.quotation_id,
      number,
      issue_date: new Date().toISOString().slice(0, 10),
      currency: original.currency,
      exchange_rate: original.exchange_rate,
      ncf_type: original.ncf_type,
      status: "DRAFT",
      created_by: user?.id,
    })
    .select("id")
    .single();
  if (createError || !newInvoice) throw new Error(createError?.message ?? "No se pudo duplicar.");

  if (items && items.length > 0) {
    const { error: insertItemsError } = await supabase.from("invoice_items").insert(
      items.map((item) => ({
        invoice_id: newInvoice.id,
        service_id: item.service_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount,
        tax: item.tax,
        tax_rate_id: item.tax_rate_id,
        subtotal: item.subtotal,
      })),
    );
    if (insertItemsError) throw new Error(insertItemsError.message);
    await recalculateInvoiceTotals(newInvoice.id);
  }

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "invoice",
    entityId: newInvoice.id,
    newValues: { duplicated_from: invoiceId },
  });

  revalidatePath("/invoices");
  redirect(`/invoices/${newInvoice.id}`);
}

/**
 * Descarta por completo una factura en BORRADOR (elimina el registro). Solo
 * permitido mientras status='DRAFT' — igual que `discardQuotationAction`.
 * Una factura DRAFT nunca tiene cobros (customer_payments solo se registran
 * sobre facturas emitidas), así que no hay riesgo de romper esa relación.
 */
export async function discardInvoiceAction(invoiceId: string): Promise<void> {
  await requirePermission("invoices.create");
  const supabase = await createSupabaseClient();

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .single();
  if (fetchError || !invoice) throw new Error("Factura no encontrada.");
  if (invoice.status !== "DRAFT") {
    throw new Error("Solo se puede descartar una factura en borrador.");
  }

  const { data: deleted, error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId)
    .eq("status", "DRAFT")
    .select("id");
  if (error) throw new Error(error.message);
  if (!deleted || deleted.length === 0) {
    throw new Error(
      "No se pudo descartar la factura (no se encontró o ya no está en borrador).",
    );
  }

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "DELETE",
    entityType: "invoice",
    entityId: invoiceId,
    oldValues: { status: "DRAFT" },
  });

  revalidatePath("/invoices");
  redirect("/invoices");
}

export async function setInvoiceResponsibleAction(invoiceId: string, userId: string | null): Promise<void> {
  await requirePermission("invoices.create");
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("invoices")
    .update({ responsible_user_id: userId })
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/invoices/${invoiceId}`);
}

const COLLECTION_ACTIONS = ["CALL", "EMAIL", "WHATSAPP", "VISIT", "NOTE", "OTHER"] as const;

export async function addCollectionHistoryAction(
  invoiceId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("invoices.view");

  const action = String(formData.get("action") ?? "");
  if (!COLLECTION_ACTIONS.includes(action as (typeof COLLECTION_ACTIONS)[number])) {
    return { error: "Selecciona un tipo de gestión válido." };
  }
  const comment = String(formData.get("comment") ?? "").trim();
  const result = String(formData.get("result") ?? "").trim();
  const nextActionDate = String(formData.get("next_action_date") ?? "").trim();

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión no encontrada." };

  const companyId = await getPrimaryCompanyId();
  const { error } = await supabase.from("invoice_collection_history").insert({
    company_id: companyId,
    invoice_id: invoiceId,
    user_id: user.id,
    action,
    comment: comment || null,
    result: result || null,
    next_action_date: nextActionDate || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/invoices/${invoiceId}`);
  return { error: null };
}
