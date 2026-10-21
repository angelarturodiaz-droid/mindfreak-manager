"use server";

import { DOC_PREFIX, nextDocNumber } from "@/lib/utils/doc-number";
import { dbErrorMessage } from "@/lib/utils/db-error";
import { validationErrorState, type MoneyActionState } from "@/lib/utils/bank-errors";

import { currencyError } from "@/features/currencies/queries";
import { todayISO } from "@/lib/utils/dates";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds, getCurrentUser } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { safeReturnTo, withReturnTo } from "@/lib/utils/return-to";
import {
  invoiceHeaderSchema,
  invoiceItemSchema,
  calculateInvoiceItemSubtotal,
  calculateInvoiceTotals,
} from "./schema";
import { buildBankDetails } from "@/features/banks/bank-details-server";
import { parseBankDetails } from "@/features/banks/bank-details";
import type { InvoicePdfData } from "@/lib/pdf/invoice-document";
import type { InvoiceElectronicPdfData } from "@/lib/pdf/invoice-electronic-document";

export type ActionState = MoneyActionState;

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
  return nextDocNumber(DOC_PREFIX.invoice, (data ?? []).map((r) => r.number));
}

async function recalculateInvoiceTotals(invoiceId: string) {
  const supabase = await createSupabaseClient();
  const [{ data: items, error }, { data: invoice }] = await Promise.all([
    supabase
      .from("invoice_items")
      .select("quantity, unit_price, discount, tax")
      .eq("invoice_id", invoiceId),
    supabase
      .from("invoices")
      .select("paid_amount, commission_percent, commission_tax_treatment, commission_tax_rate_percent")
      .eq("id", invoiceId)
      .single(),
  ]);
  if (error) throw new Error(dbErrorMessage(error.message));

  const totals = calculateInvoiceTotals(
    items ?? [],
    invoice?.commission_percent ?? 0,
    (invoice?.commission_tax_treatment as "GRAVADO" | "EXENTO" | "NO_SUJETO" | undefined) ?? "GRAVADO",
    invoice?.commission_tax_rate_percent ?? 0,
  );
  const paidAmount = invoice?.paid_amount ?? 0;

  const { error: updateError } = await supabase
    .from("invoices")
    .update({ ...totals, balance: Math.max(0, totals.total - paidAmount) })
    .eq("id", invoiceId);
  if (updateError) throw new Error(dbErrorMessage(updateError.message));
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
    commission_tax_rate_id: String(formData.get("commission_tax_rate_id") ?? ""),
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
    return validationErrorState(parsed.error.issues);
  }  const currencyProblem = await currencyError(parsed.data.currency, null);
  if (currencyProblem) return { error: currencyProblem };


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
      .select("client_id, quotation_id, quotations!projects_quotation_id_fkey(payment_terms_id)")
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

  // Tratamiento fiscal de la comisión: propio, resuelto contra el catálogo
  // igual que una línea — NUNCA hereda la exención del servicio principal.
  // Solo se exige si hay comisión (> 0).
  let commissionTaxTreatment: "GRAVADO" | "EXENTO" | "NO_SUJETO" = "GRAVADO";
  let commissionTaxRatePercent = 0;
  if (parsed.data.commission_percent > 0) {
    if (!parsed.data.commission_tax_rate_id) {
      return { error: "Selecciona el tratamiento fiscal de la comisión." };
    }
    const { data: commissionTaxRate } = await supabase
      .from("tax_rates")
      .select("rate, treatment")
      .eq("id", parsed.data.commission_tax_rate_id)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();
    if (!commissionTaxRate) {
      return { error: "El tratamiento fiscal de la comisión no es válido o ya no está activo." };
    }
    commissionTaxTreatment = commissionTaxRate.treatment as "GRAVADO" | "EXENTO" | "NO_SUJETO";
    commissionTaxRatePercent = Number(commissionTaxRate.rate);
  }

  // Datos bancarios para el pago: se sugieren solas las cuentas marcadas
  // "Mostrar en facturas" en la moneda de la factura (se cambian en el detalle).
  const { details: bankDetails } = await buildBankDetails(supabase, companyId, null, parsed.data.currency);

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
      commission_tax_rate_id: parsed.data.commission_tax_rate_id || null,
      commission_tax_treatment: commissionTaxTreatment,
      commission_tax_rate_percent: commissionTaxRatePercent,
      currency: parsed.data.currency,
      exchange_rate: parsed.data.exchange_rate,
      billing_type: parsed.data.billing_type,
      ncf: parsed.data.ncf || null,
      ncf_type: parsed.data.ncf_type || null,
      e_ncf: parsed.data.e_ncf || null,
      e_ncf_valid_until: parsed.data.e_ncf_valid_until || null,
      payment_type_code: parsed.data.payment_type_code || null,
      bank_details: bankDetails,
      status: "DRAFT",
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) return { error: dbErrorMessage(error.message) };

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "invoice",
    entityId: data.id,
    newValues: parsed.data,
  });

  revalidatePath("/invoices");
  // Creada desde un proyecto: la factura abre con "Volver al proyecto".
  const returnTo = safeReturnTo(String(formData.get("return_to") ?? ""));
  if (returnTo) revalidatePath(returnTo.split("?")[0]);
  redirect(withReturnTo(`/invoices/${data.id}`, returnTo));
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

  // «Usar otra fecha»: se mantiene la condición de pago pero el vencimiento
  // se escribe a mano (credit_days queda vacío y el trigger no lo recalcula).
  const manualDue = formData.get("manual_due") === "on";
  if (manualDue && !dueDate) return { error: "Escribe la fecha de vencimiento." };

  let creditDays: number | null = null;
  if (paymentTermsId && !manualDue) {
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

  if (error) return { error: dbErrorMessage(error.message) };

  revalidatePath(`/invoices/${invoiceId}`);
  return { error: null };
}

/**
 * Datos bancarios para el pago (migración 082): guarda qué cuentas salen en
 * el recuadro DATOS BANCARIOS del PDF. Es informativo (no toca montos ni
 * impuestos), por eso se puede cambiar mientras la factura no esté
 * cancelada ni pagada. Se guarda una copia de los datos de cada cuenta.
 */
export async function updateInvoiceBankDetailsAction(
  invoiceId: string,
  accountIds: string[],
): Promise<{ error: string | null }> {
  await requirePermission("invoices.create");
  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("status, currency, bank_details")
    .eq("id", invoiceId)
    .single();
  if (fetchError || !invoice) return { error: "Factura no encontrada." };
  if (invoice.status === "CANCELLED" || invoice.status === "PAID") {
    return { error: "La factura está cancelada o pagada: ya no se cambian sus datos bancarios." };
  }

  const { details, error } = await buildBankDetails(supabase, companyId, accountIds, invoice.currency);
  if (error) return { error };

  const { error: updateError } = await supabase
    .from("invoices")
    .update({ bank_details: details })
    .eq("id", invoiceId);
  if (updateError) return { error: dbErrorMessage(updateError.message) };

  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "invoice",
    entityId: invoiceId,
    oldValues: { bank_details: invoice.bank_details },
    newValues: { bank_details: details },
  });

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
    discount_percent: String(formData.get("discount_percent") ?? "0"),
    tax_rate_id: String(formData.get("tax_rate_id") ?? ""),
  });
  if (!parsed.success) {
    return validationErrorState(parsed.error.issues);
  }

  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  // El tratamiento fiscal y la tasa SIEMPRE se resuelven contra el catálogo
  // de Configuración → Impuestos en el servidor — nunca se confía en un %
  // enviado desde el formulario (evita que alguien manipule el request y
  // meta una tasa que no está en Settings).
  const { data: taxRate } = await supabase
    .from("tax_rates")
    .select("rate, treatment")
    .eq("id", parsed.data.tax_rate_id)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();
  if (!taxRate) {
    return { error: "El tratamiento fiscal seleccionado no es válido o ya no está activo." };
  }

  const lineAmount = parsed.data.quantity * parsed.data.unit_price;
  // discount_percent es solo la forma de entrada del usuario — la columna
  // `discount` en la base de datos sigue siendo un monto en dólares, como
  // siempre (ver comentario en invoiceItemSchema).
  const discount = Math.round(lineAmount * (parsed.data.discount_percent / 100) * 100) / 100;
  const base = lineAmount - discount;
  // Exento/No sujeto: ITBIS siempre 0, sin importar la tasa configurada en
  // esa fila del catálogo (defensa extra ante un catálogo mal cargado).
  const tax =
    taxRate.treatment === "GRAVADO"
      ? Math.round(Math.max(0, base) * (Number(taxRate.rate) / 100) * 100) / 100
      : 0;

  const subtotal = calculateInvoiceItemSubtotal({ ...parsed.data, discount, tax });
  const { error } = await supabase.from("invoice_items").insert({
    invoice_id: invoiceId,
    service_id: parsed.data.service_id || null,
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    unit_price: parsed.data.unit_price,
    discount,
    tax,
    subtotal,
    tax_rate_id: parsed.data.tax_rate_id,
    // Snapshot histórico: si luego se edita/desactiva esta tasa en
    // Settings, esta línea conserva el tratamiento y % que se usaron.
    tax_treatment: taxRate.treatment,
    tax_rate_percent: taxRate.rate,
  });

  if (error) return { error: dbErrorMessage(error.message) };

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
  if (error) throw new Error(dbErrorMessage(error.message));

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
  if (error) throw new Error(dbErrorMessage(error.message));

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

/**
 * Marca informativa "Enviada al cliente": guarda cuándo y quién la marcó.
 * NO cambia el estado de la factura (Emitida / Pago parcial / Pagada /
 * Vencida siguen igual). Solo para facturas ya emitidas: un borrador
 * todavía puede cambiar y una cancelada ya no se envía.
 */
export async function markInvoiceSentAction(invoiceId: string): Promise<void> {
  await requirePermission("invoices.create");
  const supabase = await createSupabaseClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .single();
  if (!invoice) throw new Error("Factura no encontrada.");
  if (invoice.status === "DRAFT") {
    throw new Error("Primero emite la factura; un borrador todavía puede cambiar.");
  }
  if (invoice.status === "CANCELLED") {
    throw new Error("Una factura cancelada no se puede marcar como enviada.");
  }

  const user = await getCurrentUser();
  const sentAt = new Date().toISOString();
  const { error } = await supabase
    .from("invoices")
    .update({ sent_to_client_at: sentAt, sent_to_client_by: user?.id ?? null })
    .eq("id", invoiceId);
  if (error) throw new Error(dbErrorMessage(error.message));

  await logAudit({
    companyId: await getPrimaryCompanyId(),
    action: "MARK_SENT",
    entityType: "invoice",
    entityId: invoiceId,
    newValues: { sent_to_client_at: sentAt },
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
}

/** Quita la marca "Enviada al cliente" (por si se marcó por error). */
export async function unmarkInvoiceSentAction(invoiceId: string): Promise<void> {
  await requirePermission("invoices.create");
  const supabase = await createSupabaseClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("sent_to_client_at")
    .eq("id", invoiceId)
    .single();
  if (!invoice) throw new Error("Factura no encontrada.");

  const { error } = await supabase
    .from("invoices")
    .update({ sent_to_client_at: null, sent_to_client_by: null })
    .eq("id", invoiceId);
  if (error) throw new Error(dbErrorMessage(error.message));

  await logAudit({
    companyId: await getPrimaryCompanyId(),
    action: "UNMARK_SENT",
    entityType: "invoice",
    entityId: invoiceId,
    oldValues: { sent_to_client_at: invoice.sent_to_client_at },
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
  if (error) throw new Error(dbErrorMessage(error.message));

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
      "client_id, project_id, quotation_id, currency, exchange_rate, ncf_type, billing_type, payment_terms_id, credit_days, commission_percent, commission_tax_rate_id, commission_tax_treatment, commission_tax_rate_percent, bank_details",
    )
    .eq("id", invoiceId)
    .single();
  if (origError || !original) throw new Error(origError?.message ?? "Factura no encontrada.");

  const { data: items, error: itemsError } = await supabase
    .from("invoice_items")
    .select("service_id, description, quantity, unit_price, discount, tax, tax_rate_id, tax_treatment, tax_rate_percent, subtotal")
    .eq("invoice_id", invoiceId)
    .order("sort_order");
  if (itemsError) throw new Error(dbErrorMessage(itemsError.message));

  // Mismas cuentas para el pago que el original, con sus datos al día.
  const { details: dupBankDetails } = await buildBankDetails(
    supabase,
    companyId,
    parseBankDetails(original.bank_details).map((d) => d.bank_account_id),
    original.currency,
    true,
  );

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
      // Una cotización sin proyecto = una factura: la copia queda como factura
      // directa (sin cotización). Las de proyecto conservan su enlace.
      quotation_id: original.project_id ? original.quotation_id : null,
      number,
      issue_date: todayISO(),
      currency: original.currency,
      exchange_rate: original.exchange_rate,
      ncf_type: original.ncf_type,
      billing_type: original.billing_type,
      payment_terms_id: original.payment_terms_id,
      credit_days: original.credit_days,
      // Comisión: se copia el snapshot tal cual (monto % + tratamiento
      // fiscal ya resuelto) — igual criterio que las líneas, el duplicado
      // arranca con la misma comisión que tenía el original en vez de
      // perderla silenciosamente.
      commission_percent: original.commission_percent,
      commission_tax_rate_id: original.commission_tax_rate_id,
      commission_tax_treatment: original.commission_tax_treatment,
      commission_tax_rate_percent: original.commission_tax_rate_percent,
      // Marca visual: de dónde salió esta copia (ver duplicate-invoice-
      // button y el badge "Duplicada de ..." en la lista/detalle).
      duplicated_from_id: invoiceId,
      bank_details: dupBankDetails,
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
        // Se copia el snapshot tal cual — el duplicado arranca con el mismo
        // tratamiento fiscal que tenía el original.
        tax_treatment: item.tax_treatment,
        tax_rate_percent: item.tax_rate_percent,
        subtotal: item.subtotal,
      })),
    );
    if (insertItemsError) throw new Error(dbErrorMessage(insertItemsError.message));
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
  if (error) throw new Error(dbErrorMessage(error.message));
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
  if (error) throw new Error(dbErrorMessage(error.message));
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
  if (error) return { error: dbErrorMessage(error.message) };

  revalidatePath(`/invoices/${invoiceId}`);
  return { error: null };
}

/**
 * Cambiar el cliente de una factura en Borrador (prueba BI). Como en
 * cualquier ERP: solo mientras no se haya emitido. No se permite si la
 * factura viene de un proyecto o de una cotización (pertenecen al cliente
 * original). Las líneas y los montos no cambian. Queda en Auditoría.
 */
export async function changeInvoiceClientAction(
  invoiceId: string,
  newClientId: string,
): Promise<{ error: string | null; success: string | null }> {
  await requirePermission("invoices.create");
  if (!newClientId) return { error: "Elige el cliente nuevo.", success: null };
  const supabase = await createSupabaseClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("status, client_id, project_id, quotation_id, number, clients(name)")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return { error: "Factura no encontrada.", success: null };
  if (invoice.status !== "DRAFT") {
    return { error: "Solo se puede cambiar el cliente mientras la factura está en Borrador.", success: null };
  }
  if (invoice.project_id || invoice.quotation_id) {
    return {
      error:
        "Esta factura viene de un proyecto o de una cotización del cliente actual, así que no se le puede cambiar el cliente. Descarta este borrador y crea la factura desde cero para el otro cliente.",
      success: null,
    };
  }
  if (invoice.client_id === newClientId) return { error: "Ese ya es el cliente de la factura.", success: null };

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, is_active")
    .eq("id", newClientId)
    .maybeSingle();
  if (!client || !client.is_active) return { error: "El cliente elegido no existe o está inactivo.", success: null };

  const { error } = await supabase.from("invoices").update({ client_id: newClientId }).eq("id", invoiceId);
  if (error) return { error: dbErrorMessage(error.message), success: null };

  const companyId = await getPrimaryCompanyId();
  const oldName = relationNameOf(invoice.clients);
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "invoice",
    entityId: invoiceId,
    oldValues: { client_id: invoice.client_id, cliente: oldName },
    newValues: { client_id: newClientId, cliente: client.name, cambio: "cliente" },
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return {
    error: null,
    success: `Ahora la factura ${invoice.number} es de ${client.name}. Revisa el tipo de NCF: depende de si el cliente tiene RNC (crédito fiscal) o no (consumidor final).`,
  };
}

function relationNameOf(rel: unknown): string | null {
  const r = Array.isArray(rel) ? rel[0] : rel;
  return r && typeof r === "object" && "name" in r ? String((r as { name: unknown }).name) : null;
}

/**
 * Venta sin evento: factura en Borrador a partir de una cotización APROBADA
 * que no tiene proyecto. Copia cliente, moneda y tasa, condición de pago,
 * comisión (con su tratamiento fiscal ya resuelto), datos bancarios y las
 * líneas con su impuesto tal cual se aprobaron. Se puede revisar todo antes
 * de emitir. Regla (20-oct): UNA cotización sin proyecto = UNA factura. Si ya
 * tiene un borrador, se abre ese; si ya tiene una factura activa (no
 * cancelada), no se crea otra: para algo nuevo se duplica la cotización.
 */
export async function createInvoiceFromQuotationAction(quotationId: string): Promise<{ error: string | null }> {
  await requirePermission("invoices.create");
  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  const { data: q } = await supabase
    .from("quotations")
    .select(
      "id, number, status, project_id, client_id, currency, exchange_rate, payment_terms_id, credit_days, commission_percent, commission_tax_rate_id, commission_tax_treatment, commission_tax_rate_percent, bank_details",
    )
    .eq("id", quotationId)
    .single();
  if (!q) return { error: "No se encontró la cotización." };
  if (q.status !== "APPROVED") return { error: "Solo se puede facturar una cotización aprobada." };
  if (q.project_id) {
    return { error: "Esta cotización ya es parte de un proyecto: factura desde el proyecto (pestaña Ventas y cobros)." };
  }

  // Una cotización = una factura (las canceladas no cuentan).
  const { data: existing } = await supabase
    .from("invoices")
    .select("id, number, status")
    .eq("quotation_id", quotationId)
    .is("project_id", null)
    .neq("status", "CANCELLED")
    .order("created_at")
    .limit(1);
  const current = existing?.[0];
  if (current?.status === "DRAFT") redirect(`/invoices/${current.id}`);
  if (current) {
    return {
      error: `Esta cotización ya tiene su factura (${current.number}). Si el cliente pide algo nuevo, usa «Duplicar cotización» y factura la nueva.`,
    };
  }

  const { data: items, error: itemsError } = await supabase
    .from("quotation_items")
    .select("service_id, description, quantity, unit_price, discount, tax, tax_rate_id, tax_treatment, tax_rate_percent, subtotal")
    .eq("quotation_id", quotationId)
    .order("sort_order");
  if (itemsError) return { error: dbErrorMessage(itemsError.message) };
  if (!items?.length) return { error: "La cotización no tiene líneas." };

  const accountIds = parseBankDetails(q.bank_details).map((d) => d.bank_account_id);
  const { details } = await buildBankDetails(supabase, companyId, accountIds.length ? accountIds : null, q.currency, accountIds.length > 0);

  const number = await generateInvoiceNumber(companyId);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({
      company_id: companyId,
      client_id: q.client_id,
      quotation_id: q.id,
      number,
      issue_date: todayISO(),
      currency: q.currency,
      exchange_rate: q.exchange_rate,
      payment_terms_id: q.payment_terms_id,
      credit_days: q.credit_days,
      commission_percent: q.commission_percent,
      commission_tax_rate_id: q.commission_tax_rate_id,
      commission_tax_treatment: q.commission_tax_treatment,
      commission_tax_rate_percent: q.commission_tax_rate_percent,
      bank_details: details,
      status: "DRAFT",
      created_by: user?.id,
    })
    .select("id")
    .single();
  if (error || !inv) return { error: dbErrorMessage(error?.message ?? "No se pudo crear la factura.") };

  const { error: insertError } = await supabase.from("invoice_items").insert(
    items.map((item, index) => ({
      invoice_id: inv.id,
      service_id: item.service_id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount,
      tax: item.tax,
      tax_rate_id: item.tax_rate_id,
      // Mismo tratamiento fiscal que se le aprobó al cliente (snapshot).
      tax_treatment: item.tax_treatment,
      tax_rate_percent: item.tax_rate_percent,
      subtotal: item.subtotal,
      sort_order: index,
    })),
  );
  if (insertError) return { error: dbErrorMessage(insertError.message) };
  await recalculateInvoiceTotals(inv.id);

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "invoice",
    entityId: inv.id,
    newValues: { desde_cotizacion: q.number, lineas: items.length },
  });
  revalidatePath("/invoices");
  revalidatePath(`/quotations/${quotationId}`);
  redirect(`/invoices/${inv.id}`);
}
