"use server";

import { dbErrorMessage } from "@/lib/utils/db-error";
import { validationErrorState, type MoneyActionState } from "@/lib/utils/bank-errors";

import { currencyError } from "@/features/currencies/queries";
import { todayISO } from "@/lib/utils/dates";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import {
  quotationHeaderSchema,
  quotationItemSchema,
  calculateItemSubtotal,
  calculateQuotationTotals,
} from "./schema";
import { buildBankDetails } from "@/features/banks/bank-details-server";
import { parseBankDetails } from "@/features/banks/bank-details";
import type { QuotationPdfData } from "@/lib/pdf/quotation-document";

export type ActionState = MoneyActionState;

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

/**
 * Genera el siguiente número correlativo. Antes usaba count(*)+1 — se
 * rompía en cuanto había un hueco en la numeración (ej. una cotización
 * borrada), porque el conteo de filas ya no coincidía con el número más
 * alto usado. Ahora toma el máximo real de los números existentes
 * (parseado en JS para no depender del orden lexicográfico del texto,
 * que falla apenas hay más de 9999).
 */
async function generateQuotationNumber(companyId: string): Promise<string> {
  const supabase = await createSupabaseClient();
  const { data } = await supabase.from("quotations").select("number").eq("company_id", companyId);
  const maxNum = (data ?? []).reduce((max, row) => {
    const n = parseInt(row.number.replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `COT-${String(maxNum + 1).padStart(4, "0")}`;
}

/** Recalcula y guarda los totales de la cotización a partir de sus líneas actuales. */
async function recalculateQuotationTotals(quotationId: string) {
  const supabase = await createSupabaseClient();
  const [{ data: items, error }, { data: quotation }] = await Promise.all([
    supabase
      .from("quotation_items")
      .select("quantity, unit_price, discount, tax, estimated_unit_cost")
      .eq("quotation_id", quotationId),
    supabase
      .from("quotations")
      .select("commission_percent, commission_tax_treatment, commission_tax_rate_percent")
      .eq("id", quotationId)
      .single(),
  ]);
  if (error) throw new Error(dbErrorMessage(error.message));

  const totals = calculateQuotationTotals(
    items ?? [],
    quotation?.commission_percent ?? 0,
    (quotation?.commission_tax_treatment as "GRAVADO" | "EXENTO" | "NO_SUJETO" | undefined) ?? "GRAVADO",
    quotation?.commission_tax_rate_percent ?? 0,
  );
  const { error: updateError } = await supabase
    .from("quotations")
    .update(totals)
    .eq("id", quotationId);
  if (updateError) throw new Error(dbErrorMessage(updateError.message));
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
    payment_terms_id: String(formData.get("payment_terms_id") ?? ""),
    commission_percent: String(formData.get("commission_percent") ?? "0"),
    commission_tax_rate_id: String(formData.get("commission_tax_rate_id") ?? ""),
  });
  if (!parsed.success) {
    return validationErrorState(parsed.error.issues);
  }  const currencyProblem = await currencyError(parsed.data.currency, null);
  if (currencyProblem) return { error: currencyProblem };


  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();

  // Cotización ADICIONAL de un proyecto (pestaña Servicios): mismo cliente
  // que el proyecto; al aprobarse, sus líneas se suman al proyecto.
  const projectId = String(formData.get("project_id") ?? "") || null;
  if (projectId) {
    const { data: proj } = await supabase.from("projects").select("client_id, status").eq("id", projectId).maybeSingle();
    if (!proj) return { error: "No se encontró el proyecto." };
    if (proj.status === "CANCELLED") return { error: "El proyecto está cancelado." };
    if (proj.client_id !== parsed.data.client_id) {
      return { error: "La cotización adicional debe ser para el mismo cliente del proyecto." };
    }
  }

  const number = await generateQuotationNumber(companyId);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Si se eligió una condición de pago, se "congelan" sus valores en la
  // cotización (mismo criterio que exchange_rate) — si el catálogo cambia
  // después, esta cotización ya hecha no se ve afectada.
  let paymentTermsFields: {
    payment_terms_id: string | null;
    credit_days: number | null;
    payment_method: string | null;
    advance_percent: number | null;
    balance_percent: number | null;
  } = {
    payment_terms_id: null,
    credit_days: null,
    payment_method: null,
    advance_percent: null,
    balance_percent: null,
  };
  if (parsed.data.payment_terms_id) {
    const { data: term, error: termError } = await supabase
      .from("payment_terms")
      .select("id, credit_days, payment_method, advance_percent, balance_percent")
      .eq("id", parsed.data.payment_terms_id)
      .single();
    if (termError || !term) return { error: "La condición de pago seleccionada no es válida." };
    paymentTermsFields = {
      payment_terms_id: term.id,
      credit_days: term.credit_days,
      payment_method: term.payment_method,
      advance_percent: term.advance_percent,
      balance_percent: term.balance_percent,
    };
  }

  // Tratamiento fiscal de la comisión: propio, resuelto contra el catálogo
  // igual que una línea — NUNCA hereda la exención del servicio principal.
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
      commission_percent: parsed.data.commission_percent,
      commission_tax_rate_id: parsed.data.commission_tax_rate_id || null,
      commission_tax_treatment: commissionTaxTreatment,
      commission_tax_rate_percent: commissionTaxRatePercent,
      status: "DRAFT",
      created_by: user?.id,
      project_id: projectId,
      ...paymentTermsFields,
    })
    .select("id")
    .single();

  if (error) return { error: dbErrorMessage(error.message) };

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
    return validationErrorState(parsed.error.issues);
  }

  const supabase = await createSupabaseClient();
  const { data: current } = await supabase.from("quotations").select("currency").eq("id", quotationId).single();
  const currencyProblem = await currencyError(parsed.data.currency, current?.currency);
  if (currencyProblem) return { error: currencyProblem };
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

  if (error) return { error: dbErrorMessage(error.message) };

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

/**
 * Datos bancarios para el pago (migración 082), opcional en cotizaciones:
 * qué cuentas salen en el recuadro DATOS BANCARIOS del PDF (ej. para el
 * anticipo). Informativo; se puede cambiar mientras no esté cancelada ni
 * rechazada. Se guarda una copia de los datos de cada cuenta.
 */
export async function updateQuotationBankDetailsAction(
  quotationId: string,
  accountIds: string[],
): Promise<{ error: string | null }> {
  await requirePermission("quotations.update");
  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  const { data: quotation, error: fetchError } = await supabase
    .from("quotations")
    .select("status, currency, bank_details")
    .eq("id", quotationId)
    .single();
  if (fetchError || !quotation) return { error: "Cotización no encontrada." };
  if (quotation.status === "CANCELLED" || quotation.status === "REJECTED") {
    return { error: "La cotización está cancelada o rechazada: ya no se cambian sus datos bancarios." };
  }

  const { details, error } = await buildBankDetails(supabase, companyId, accountIds, quotation.currency);
  if (error) return { error };

  const { error: updateError } = await supabase
    .from("quotations")
    .update({ bank_details: details })
    .eq("id", quotationId);
  if (updateError) return { error: dbErrorMessage(updateError.message) };

  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "quotation",
    entityId: quotationId,
    oldValues: { bank_details: quotation.bank_details },
    newValues: { bank_details: details },
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
    discount_percent: String(formData.get("discount_percent") ?? "0"),
    tax_rate_id: String(formData.get("tax_rate_id") ?? ""),
    estimated_unit_cost: String(formData.get("estimated_unit_cost") ?? "0"),
  });
  if (!parsed.success) {
    return validationErrorState(parsed.error.issues);
  }

  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  // El tratamiento fiscal y la tasa SIEMPRE se resuelven contra el catálogo
  // de Configuración → Impuestos en el servidor — nunca se confía en un %
  // enviado desde el formulario.
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

  // El impuesto se calcula DESPUÉS del subtotal y el descuento: base =
  // (cantidad × precio) − descuento; impuesto = base × %. Exento/No sujeto
  // siempre da 0, sin importar la tasa configurada en esa fila del catálogo.
  const lineAmount = parsed.data.quantity * parsed.data.unit_price;
  const discount = Math.round(lineAmount * (parsed.data.discount_percent / 100) * 100) / 100;
  const base = lineAmount - discount;
  const tax =
    taxRate.treatment === "GRAVADO"
      ? Math.round(Math.max(0, base) * (Number(taxRate.rate) / 100) * 100) / 100
      : 0;

  const subtotal = calculateItemSubtotal({ ...parsed.data, discount, tax });
  const { error } = await supabase.from("quotation_items").insert({
    quotation_id: quotationId,
    service_id: parsed.data.service_id || null,
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    unit_price: parsed.data.unit_price,
    discount,
    tax,
    estimated_unit_cost: parsed.data.estimated_unit_cost,
    subtotal,
    tax_rate_id: parsed.data.tax_rate_id,
    // Snapshot histórico: si luego se edita/desactiva esta tasa en
    // Settings, esta línea conserva el tratamiento y % que se usaron.
    tax_treatment: taxRate.treatment,
    tax_rate_percent: taxRate.rate,
  });

  if (error) return { error: dbErrorMessage(error.message) };

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
  if (error) throw new Error(dbErrorMessage(error.message));

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
  if (error) throw new Error(dbErrorMessage(error.message));

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
  await requirePermission("quotations.update");
  const supabase = await createSupabaseClient();

  const { data: quotation } = await supabase
    .from("quotations")
    .select("total")
    .eq("id", quotationId)
    .single();
  if (!quotation || quotation.total <= 0) {
    throw new Error("La cotización necesita al menos una línea antes de enviarse.");
  }

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

  // Cotización ligada a un proyecto (adicional, o creada desde sus líneas):
  // sus líneas se suman a la pestaña Servicios del proyecto (migración 086).
  const { data: q } = await supabase.from("quotations").select("project_id").eq("id", quotationId).single();
  if (q?.project_id) {
    const { error } = await supabase.rpc("project_apply_quotation", { p_quotation_id: quotationId });
    // PGRST202 = la función aún no existe (migración 086 sin aplicar): la aprobación sigue valiendo.
    if (error && error.code !== "PGRST202") throw new Error(dbErrorMessage(error.message));
    revalidatePath(`/projects/${q.project_id}`);
  }
}

/**
 * Proyecto creado SIN cotización: arma una cotización en Borrador con sus
 * líneas (pestaña Servicios → "Crear cotización con estas líneas") para que
 * el cliente la apruebe. Al aprobarse pasa a ser la cotización del proyecto
 * y sus líneas reemplazan las escritas a mano. Impuesto: el del servicio o
 * el predeterminado (se puede cambiar en la cotización mientras esté en
 * Borrador).
 */
export async function createQuotationFromProjectAction(projectId: string): Promise<{ error: string | null }> {
  await requirePermission("quotations.create");
  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  const { data: project } = await supabase
    .from("projects")
    .select("id, client_id, contact_id, quotation_id, status, number")
    .eq("id", projectId)
    .single();
  if (!project) return { error: "No se encontró el proyecto." };
  if (project.quotation_id) return { error: "Este proyecto ya tiene una cotización aprobada." };
  if (project.status === "CANCELLED") return { error: "El proyecto está cancelado." };

  // Si ya hay una en curso, se abre esa (no se duplican).
  const { data: open } = await supabase
    .from("quotations")
    .select("id")
    .eq("project_id", projectId)
    .eq("created_from_project", true)
    .in("status", ["DRAFT", "SENT", "VIEWED", "NEGOTIATING"])
    .maybeSingle();
  if (open) redirect(`/quotations/${open.id}`);

  const { data: items } = await supabase
    .from("project_items")
    .select("service_id, description, quantity, unit_price, estimated_cost, sort_order, services(default_tax_rate_id)")
    .eq("project_id", projectId)
    .order("sort_order");
  if (!items?.length) return { error: "Agrega al menos una línea antes de crear la cotización." };

  const { data: taxRates } = await supabase
    .from("tax_rates")
    .select("id, rate, treatment, is_default")
    .eq("company_id", companyId)
    .eq("is_active", true);
  const fallback = (taxRates ?? []).find((t) => t.is_default) ?? (taxRates ?? [])[0];
  if (!fallback) return { error: "Configura al menos un impuesto en Configuración → Impuestos." };

  const { data: company } = await supabase.from("companies").select("base_currency").eq("id", companyId).single();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const number = await generateQuotationNumber(companyId);
  const { data: created, error } = await supabase
    .from("quotations")
    .insert({
      company_id: companyId,
      client_id: project.client_id,
      contact_id: project.contact_id,
      project_id: project.id,
      created_from_project: true,
      number,
      issue_date: todayISO(),
      currency: company?.base_currency ?? "DOP",
      exchange_rate: 1,
      status: "DRAFT",
      created_by: user?.id,
    })
    .select("id")
    .single();
  if (error || !created) return { error: dbErrorMessage(error?.message ?? "No se pudo crear la cotización.") };

  const rows = items.map((it, index) => {
    const service = (Array.isArray(it.services) ? it.services[0] : it.services) as { default_tax_rate_id: string | null } | null;
    const rate = (taxRates ?? []).find((t) => t.id === service?.default_tax_rate_id) ?? fallback;
    const quantity = Number(it.quantity);
    const unitPrice = Number(it.unit_price);
    const base = quantity * unitPrice;
    const tax = rate.treatment === "GRAVADO" ? Math.round(Math.max(0, base) * (Number(rate.rate) / 100) * 100) / 100 : 0;
    return {
      quotation_id: created.id,
      service_id: it.service_id,
      description: it.description,
      quantity,
      unit_price: unitPrice,
      discount: 0,
      tax,
      estimated_unit_cost: quantity > 0 ? Math.round((Number(it.estimated_cost) / quantity) * 100) / 100 : 0,
      subtotal: calculateItemSubtotal({ quantity, unit_price: unitPrice, discount: 0, tax }),
      tax_rate_id: rate.id,
      tax_treatment: rate.treatment,
      tax_rate_percent: rate.rate,
      sort_order: index,
    };
  });
  const { error: itemsError } = await supabase.from("quotation_items").insert(rows);
  if (itemsError) return { error: dbErrorMessage(itemsError.message) };
  await recalculateQuotationTotals(created.id);

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "quotation",
    entityId: created.id,
    newValues: { desde_proyecto: project.number, lineas: rows.length },
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/quotations");
  redirect(`/quotations/${created.id}`);
}

/**
 * Enviada → En negociación: el cliente pidió cambios. Permite editar líneas
 * y precios; luego se marca como enviada de nuevo, se aprueba o se rechaza.
 */
export async function negotiateQuotationAction(quotationId: string): Promise<void> {
  const supabase = await createSupabaseClient();
  const { data: q } = await supabase.from("quotations").select("status").eq("id", quotationId).single();
  if (!q) throw new Error("No se encontró la cotización.");
  if (q.status !== "SENT" && q.status !== "VIEWED") {
    throw new Error("Solo una cotización enviada puede pasar a negociación.");
  }
  await changeQuotationStatus(quotationId, "NEGOTIATING", "quotations.update");
}

export async function rejectQuotationAction(quotationId: string): Promise<void> {
  await changeQuotationStatus(quotationId, "REJECTED", "quotations.approve");
}

export async function cancelQuotationAction(quotationId: string): Promise<void> {
  await changeQuotationStatus(quotationId, "CANCELLED", "quotations.update");
}

/**
 * Obtiene los datos necesarios para renderizar el PDF de la cotización. El
 * render (`pdf()` de @react-pdf/renderer) se hace en el navegador — ver
 * `getInvoicePdfDataAction` en features/invoices/actions.ts para el porqué.
 */
export async function getQuotationPdfDataAction(
  quotationId: string,
): Promise<{ data: QuotationPdfData | null; error: string | null }> {
  await requirePermission("quotations.view");

  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  const [{ data: quotation, error: qError }, { data: items, error: iError }, { data: company }] =
    await Promise.all([
      supabase
        .from("quotations")
        .select("*, clients(name, tax_id, email, phone), payment_terms(name)")
        .eq("id", quotationId)
        .single(),
      supabase
        .from("quotation_items")
        .select("description, quantity, unit_price, discount, subtotal")
        .eq("quotation_id", quotationId)
        .order("sort_order"),
      supabase
        .from("companies")
        .select("name, legal_name, tax_id, address, phone, logo_url, brand_primary, brand_accent")
        .eq("id", companyId)
        .single(),
    ]);

  if (qError || !quotation) return { data: null, error: qError?.message ?? "Cotización no encontrada." };
  if (iError) return { data: null, error: iError.message };

  const clientData = quotation.clients as
    | { name: string; tax_id: string | null; email: string | null; phone: string | null }
    | { name: string; tax_id: string | null; email: string | null; phone: string | null }[]
    | null;
  const clientRecord = Array.isArray(clientData) ? clientData[0] : clientData;

  const paymentTermsData = quotation.payment_terms as { name: string } | { name: string }[] | null;
  const paymentTermsName = Array.isArray(paymentTermsData) ? paymentTermsData[0]?.name : paymentTermsData?.name;

  return {
    data: {
      company: company ?? {
        name: "Mindfreak Manager",
        legal_name: null,
        tax_id: null,
        logo_url: null,
        brand_primary: "#0b0e14",
        brand_accent: "#17a6b8",
      },
      quotation: { ...quotation, payment_terms_name: paymentTermsName ?? null },
      client: {
        name: clientRecord?.name ?? "Cliente",
        tax_id: clientRecord?.tax_id ?? null,
        email: clientRecord?.email ?? null,
        phone: clientRecord?.phone ?? null,
      },
      items: items ?? [],
    },
    error: null,
  };
}

/**
 * Sube el PDF de la cotización (ya renderizado en el navegador) a Storage,
 * registra/actualiza el documento en la tabla `documents` y devuelve una
 * URL firmada (7 días) para compartir.
 */
export async function uploadQuotationPdfAction(
  quotationId: string,
  pdfBase64: string,
): Promise<{ url: string | null; error: string | null }> {
  await requirePermission("quotations.view");

  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  const { data: quotation, error: qError } = await supabase
    .from("quotations")
    .select("number")
    .eq("id", quotationId)
    .single();

  if (qError || !quotation) return { url: null, error: qError?.message ?? "Cotización no encontrada." };

  const buffer = Buffer.from(pdfBase64, "base64");

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

/**
 * Duplica una cotización existente:/**
 * Duplica una cotización existente: crea una nueva en BORRADOR con el mismo
 * cliente/contacto y copia todas las líneas. La original nunca se toca.
 * Mismo patrón que `duplicateInvoiceAction` — ver conversación con el usuario.
 */
export async function duplicateQuotationAction(quotationId: string): Promise<void> {
  await requirePermission("quotations.create");
  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  const { data: original, error: origError } = await supabase
    .from("quotations")
    .select(
      "client_id, contact_id, currency, exchange_rate, terms, payment_terms_id, credit_days, payment_method, advance_percent, balance_percent, commission_percent, commission_tax_rate_id, commission_tax_treatment, commission_tax_rate_percent, bank_details",
    )
    .eq("id", quotationId)
    .single();
  if (origError || !original) throw new Error(origError?.message ?? "Cotización no encontrada.");

  const { data: items, error: itemsError } = await supabase
    .from("quotation_items")
    .select(
      "service_id, description, quantity, unit_price, discount, tax, tax_rate_id, tax_treatment, tax_rate_percent, estimated_unit_cost, subtotal",
    )
    .eq("quotation_id", quotationId)
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

  const number = await generateQuotationNumber(companyId);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: newQuotation, error: createError } = await supabase
    .from("quotations")
    .insert({
      company_id: companyId,
      client_id: original.client_id,
      contact_id: original.contact_id,
      number,
      issue_date: todayISO(),
      currency: original.currency,
      exchange_rate: original.exchange_rate,
      terms: original.terms,
      payment_terms_id: original.payment_terms_id,
      credit_days: original.credit_days,
      payment_method: original.payment_method,
      advance_percent: original.advance_percent,
      balance_percent: original.balance_percent,
      // Comisión: se copia el snapshot tal cual (monto % + tratamiento
      // fiscal ya resuelto) — igual criterio que las líneas, el duplicado
      // arranca con la misma comisión que tenía el original en vez de
      // perderla silenciosamente.
      commission_percent: original.commission_percent,
      commission_tax_rate_id: original.commission_tax_rate_id,
      commission_tax_treatment: original.commission_tax_treatment,
      commission_tax_rate_percent: original.commission_tax_rate_percent,
      // Marca visual: de dónde salió esta copia (ver duplicate-quotation-
      // button y el badge "Duplicada de ..." en la lista/detalle).
      duplicated_from_id: quotationId,
      bank_details: dupBankDetails,
      status: "DRAFT",
      created_by: user?.id,
    })
    .select("id")
    .single();
  if (createError || !newQuotation)
    throw new Error(createError?.message ?? "No se pudo duplicar.");

  if (items && items.length > 0) {
    const { error: insertItemsError } = await supabase.from("quotation_items").insert(
      items.map((item) => ({
        quotation_id: newQuotation.id,
        service_id: item.service_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount,
        tax: item.tax,
        tax_rate_id: item.tax_rate_id,
        // Se copia el snapshot tal cual (no se re-resuelve contra Settings)
        // — el duplicado arranca con el mismo tratamiento fiscal que tenía
        // el original, aunque el catálogo haya cambiado desde entonces.
        tax_treatment: item.tax_treatment,
        tax_rate_percent: item.tax_rate_percent,
        estimated_unit_cost: item.estimated_unit_cost,
        subtotal: item.subtotal,
      })),
    );
    if (insertItemsError) throw new Error(dbErrorMessage(insertItemsError.message));
    await recalculateQuotationTotals(newQuotation.id);
  }

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "quotation",
    entityId: newQuotation.id,
    newValues: { duplicated_from: quotationId },
  });

  revalidatePath("/quotations");
  redirect(`/quotations/${newQuotation.id}`);
}

/**
 * Descarta por completo una cotización en BORRADOR (elimina el registro,
 * no solo cambia su estado). Solo permitido mientras status='DRAFT' — una
 * vez enviada/aprobada/rechazada, se usa `cancelQuotationAction` en su lugar
 * (que preserva el registro para auditoría, F0 sección M). Pensado para el
 * caso de "me equivoqué / cambié de opinión" justo después de crearla, antes
 * de que tenga actividad real.
 */
export async function discardQuotationAction(quotationId: string): Promise<void> {
  await requirePermission("quotations.update");
  const supabase = await createSupabaseClient();

  const { data: quotation, error: fetchError } = await supabase
    .from("quotations")
    .select("status")
    .eq("id", quotationId)
    .single();
  if (fetchError || !quotation) throw new Error("Cotización no encontrada.");
  if (quotation.status !== "DRAFT") {
    throw new Error("Solo se puede descartar una cotización en borrador.");
  }

  const { data: deleted, error } = await supabase
    .from("quotations")
    .delete()
    .eq("id", quotationId)
    .eq("status", "DRAFT")
    .select("id");
  if (error) throw new Error(dbErrorMessage(error.message));
  if (!deleted || deleted.length === 0) {
    throw new Error(
      "No se pudo descartar la cotización (no se encontró o ya no está en borrador).",
    );
  }

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "DELETE",
    entityType: "quotation",
    entityId: quotationId,
    oldValues: { status: "DRAFT" },
  });

  revalidatePath("/quotations");
  redirect("/quotations");
}

/**
 * Cambiar el cliente de una cotización en Borrador (prueba BI). En
 * Negociación ya se le envió a ese cliente, así que no se cambia. No se
 * permite si ya generó un proyecto. Se quita el contacto del cliente
 * anterior. Las líneas y los montos no cambian. Queda en Auditoría.
 */
export async function changeQuotationClientAction(
  quotationId: string,
  newClientId: string,
): Promise<{ error: string | null; success: string | null }> {
  await requirePermission("quotations.update");
  if (!newClientId) return { error: "Elige el cliente nuevo.", success: null };
  const supabase = await createSupabaseClient();

  const { data: quotation } = await supabase
    .from("quotations")
    .select("status, client_id, project_id, number, clients(name)")
    .eq("id", quotationId)
    .maybeSingle();
  if (!quotation) return { error: "Cotización no encontrada.", success: null };
  if (quotation.status !== "DRAFT") {
    return {
      error: "Solo se puede cambiar el cliente mientras la cotización está en Borrador (después ya se le envió a ese cliente).",
      success: null,
    };
  }
  if (quotation.project_id) {
    return { error: "Esta cotización ya generó un proyecto; no se le puede cambiar el cliente.", success: null };
  }
  if (quotation.client_id === newClientId) return { error: "Ese ya es el cliente de la cotización.", success: null };

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, is_active")
    .eq("id", newClientId)
    .maybeSingle();
  if (!client || !client.is_active) return { error: "El cliente elegido no existe o está inactivo.", success: null };

  const { error } = await supabase
    .from("quotations")
    .update({ client_id: newClientId, contact_id: null })
    .eq("id", quotationId);
  if (error) return { error: dbErrorMessage(error.message), success: null };

  const companyId = await getPrimaryCompanyId();
  const prev = Array.isArray(quotation.clients) ? quotation.clients[0] : quotation.clients;
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "quotation",
    entityId: quotationId,
    oldValues: { client_id: quotation.client_id, cliente: (prev as { name?: string } | null)?.name ?? null },
    newValues: { client_id: newClientId, cliente: client.name, cambio: "cliente" },
  });

  revalidatePath(`/quotations/${quotationId}`);
  revalidatePath("/quotations");
  return { error: null, success: `Ahora la cotización ${quotation.number} es de ${client.name}. Si tenía un contacto, se quitó: elige el del cliente nuevo si hace falta.` };
}
