"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import {
  invoiceHeaderSchema,
  invoiceItemSchema,
  calculateInvoiceItemSubtotal,
  calculateInvoiceTotals,
} from "./schema";
import { InvoicePdfDocument } from "@/lib/pdf/invoice-document";

export type ActionState = { error: string | null };

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

async function generateInvoiceNumber(companyId: string): Promise<string> {
  const supabase = await createSupabaseClient();
  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `INV-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

async function recalculateInvoiceTotals(invoiceId: string) {
  const supabase = await createSupabaseClient();
  const { data: items, error } = await supabase
    .from("invoice_items")
    .select("quantity, unit_price, discount, tax")
    .eq("invoice_id", invoiceId);
  if (error) throw new Error(error.message);

  const totals = calculateInvoiceTotals(items ?? []);
  const { data: invoice } = await supabase
    .from("invoices")
    .select("paid_amount")
    .eq("id", invoiceId)
    .single();
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
    currency: String(formData.get("currency") ?? "DOP"),
    exchange_rate: String(formData.get("exchange_rate") ?? "1"),
    ncf: String(formData.get("ncf") ?? ""),
    ncf_type: String(formData.get("ncf_type") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createSupabaseClient();
  let clientId = parsed.data.client_id || null;
  let quotationId: string | null = null;

  if (parsed.data.project_id) {
    const { data: project, error: projError } = await supabase
      .from("projects")
      .select("client_id, quotation_id")
      .eq("id", parsed.data.project_id)
      .single();
    if (projError || !project) return { error: "Proyecto no encontrado." };
    clientId = project.client_id;
    quotationId = project.quotation_id;
  }

  if (!clientId) {
    return { error: "Selecciona un cliente o un proyecto." };
  }

  const companyId = await getPrimaryCompanyId();
  const number = await generateInvoiceNumber(companyId);
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
      currency: parsed.data.currency,
      exchange_rate: parsed.data.exchange_rate,
      ncf: parsed.data.ncf || null,
      ncf_type: parsed.data.ncf_type || null,
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
  const ncf = String(formData.get("ncf") ?? "");
  const ncfType = String(formData.get("ncf_type") ?? "");

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("invoices")
    .update({
      due_date: dueDate || null,
      ncf: ncf || null,
      ncf_type: ncfType || null,
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
 * Genera el PDF de la factura, lo sube a Storage y devuelve una URL firmada
 * (7 días) para compartir. Mismo patrón que `generateQuotationShareLinkAction`
 * (F8) — ver F0-Arquitectura, sección R.
 */
export async function generateInvoiceShareLinkAction(
  invoiceId: string,
): Promise<{ url: string | null; error: string | null }> {
  await requirePermission("invoices.view");

  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  const [{ data: invoice, error: iError }, { data: items, error: itError }, { data: company }] =
    await Promise.all([
      supabase.from("invoices").select("*, clients(name)").eq("id", invoiceId).single(),
      supabase
        .from("invoice_items")
        .select("description, quantity, unit_price, discount, subtotal")
        .eq("invoice_id", invoiceId)
        .order("sort_order"),
      supabase
        .from("companies")
        .select("name, legal_name, tax_id")
        .eq("id", companyId)
        .single(),
    ]);

  if (iError || !invoice) return { url: null, error: iError?.message ?? "Factura no encontrada." };
  if (itError) return { url: null, error: itError.message };

  const clientData = invoice.clients as { name: string } | { name: string }[] | null;
  const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;

  const buffer = await renderToBuffer(
    InvoicePdfDocument({
      company: company ?? { name: "Mindfreak Manager", legal_name: null, tax_id: null },
      invoice,
      client: { name: clientName ?? "Cliente" },
      items: items ?? [],
    }),
  );

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

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId)
    .eq("status", "DRAFT");
  if (error) throw new Error(error.message);

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
