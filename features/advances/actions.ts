"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { bankRuleState, overdraftConfirmed, type MoneyActionState } from "@/lib/utils/bank-errors";
import { formatMoney } from "@/lib/utils/money";
import { todayISO } from "@/lib/utils/dates";
import { foreignPaymentErrorState, foreignPaymentRpcParams, parseForeignPayment } from "@/features/payments/schema";
import type { AdvanceReceiptPdfData } from "@/lib/pdf/advance-receipt-document";
import { advanceErrorMessage, advanceReceiptSummary, advanceSchema, parseTarget } from "./schema";
import { getAdvance, receivedToDateFor } from "./queries";

/**
 * Anticipos de clientes (V1-3). Igual que los cobros: la lógica que mueve
 * dinero vive en funciones de la base de datos (migración 090), atómicas.
 * Aquí solo se valida el formulario y se traducen los errores.
 */

export type AdvanceActionState = MoneyActionState;

async function companyId(): Promise<string> {
  const ids = await getCurrentUserCompanyIds();
  if (ids.length === 0) throw new Error("Tu usuario no está asignado a ninguna compañía.");
  return ids[0];
}

function revalidateAll(a?: { project_id: string | null; quotation_id: string | null; id?: string } | null) {
  revalidatePath("/payments");
  if (a?.project_id) revalidatePath(`/projects/${a.project_id}`);
  if (a?.quotation_id) revalidatePath(`/quotations/${a.quotation_id}`);
  if (a?.id) revalidatePath(`/advances/${a.id}`);
}

/** Registrar un anticipo. Si sale bien, abre el anticipo (con su recibo). */
export async function registerAdvanceAction(_prev: AdvanceActionState, formData: FormData): Promise<AdvanceActionState> {
  await requirePermission("payments.create");
  const parsed = advanceSchema.safeParse({
    client_id: String(formData.get("client_id") ?? ""),
    target: String(formData.get("target") ?? ""),
    receipt_date: String(formData.get("receipt_date") ?? ""),
    amount: String(formData.get("amount") ?? "0").replace(/,/g, ""),
    currency: String(formData.get("currency") ?? ""),
    method: String(formData.get("method") ?? "TRANSFER"),
    reference: String(formData.get("reference") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    before_cutoff: formData.get("before_cutoff") === "1",
    bank_account_id: String(formData.get("bank_account_id") ?? ""),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Revisa los datos.";
    return { error: msg };
  }
  const v = parsed.data;
  const target = parseTarget(v.target);
  if (!target) return { error: "Elige para qué es el anticipo (proyecto, cotización o solo el cliente)." };

  const fx = parseForeignPayment(formData);
  if (!fx.success) return { error: fx.error.issues[0]?.message ?? "Revisa los datos de la moneda diferente." };

  const supabase = await createSupabaseClient();
  const { data: id, error } = await supabase.rpc("register_customer_advance", {
    p_company_id: await companyId(),
    p_client_id: v.client_id,
    p_project_id: target.projectId,
    p_quotation_id: target.quotationId,
    p_receipt_date: v.receipt_date,
    p_amount: v.amount,
    p_currency: v.currency,
    p_method: v.method,
    p_reference: v.reference || null,
    p_notes: v.notes || null,
    p_before_cutoff: v.before_cutoff,
    p_bank_account_id: v.before_cutoff ? null : v.bank_account_id || null,
    ...(v.before_cutoff ? {} : foreignPaymentRpcParams(fx.data)),
  });
  if (error) {
    const fxState = foreignPaymentErrorState(error.message, "COBRO");
    if (fxState) return fxState;
    return { error: advanceErrorMessage(error.message) };
  }

  revalidateAll({ project_id: target.projectId, quotation_id: target.quotationId });
  redirect(`/advances/${id as string}?nuevo=1`);
}

/** Aplicar uno o varios anticipos a una factura (sin mover el banco). */
export async function applyAdvancesAction(
  invoiceId: string,
  _prev: AdvanceActionState,
  formData: FormData,
): Promise<AdvanceActionState> {
  await requirePermission("payments.create");
  let items: { advance_id: string; amount: number }[] = [];
  try {
    const raw = JSON.parse(String(formData.get("applications") ?? "[]")) as { advance_id: string; amount: number }[];
    items = raw
      .map((r) => ({ advance_id: String(r.advance_id), amount: Math.round(Number(r.amount) * 100) / 100 }))
      .filter((r) => r.amount > 0);
  } catch {
    return { error: "No se pudo leer lo que elegiste. Recarga la página e inténtalo de nuevo." };
  }
  if (items.length === 0) return { error: "Marca al menos un anticipo y escribe cuánto aplicar." };

  const supabase = await createSupabaseClient();
  // Fecha de hoy en República Dominicana (la base de datos usa UTC: de noche saldría el día siguiente).
  const date = String(formData.get("apply_date") ?? "") || todayISO();
  let total = 0;
  for (const it of items) {
    const { error } = await supabase.rpc("apply_customer_advance", {
      p_advance_id: it.advance_id,
      p_invoice_id: invoiceId,
      p_amount: it.amount,
      p_date: date,
    });
    if (error) {
      revalidatePath(`/invoices/${invoiceId}`);
      return {
        error: null,
        blockedTitle: total > 0 ? "Se aplicó solo una parte" : "No se pudo aplicar",
        blocked: `${advanceErrorMessage(error.message)}${total > 0 ? ` (Ya se aplicaron ${total.toFixed(2)} antes de este error.)` : ""}`,
      };
    }
    total += it.amount;
  }
  const { data: inv } = await supabase.from("invoices").select("number, currency, balance, project_id, quotation_id").eq("id", invoiceId).single();
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidateAll(inv ? { project_id: inv.project_id, quotation_id: inv.quotation_id } : null);
  for (const it of items) revalidatePath(`/advances/${it.advance_id}`);
  const cur = inv?.currency ?? "DOP";
  return {
    error: null,
    successTitle: "Anticipo aplicado",
    success: `Se descontaron ${formatMoney(total, cur)} de anticipos a la factura ${inv?.number ?? ""}. ${
      Number(inv?.balance ?? 0) > 0
        ? `Ahora falta por cobrar ${formatMoney(Number(inv?.balance), cur)}: regístralo con «Registrar cobro» cuando el cliente pague.`
        : "La factura quedó pagada."
    } El banco no se mueve: ese dinero ya había entrado el día del anticipo.`,
    successId: Date.now(),
  };
}

/** Quitar una aplicación hecha por error (vuelve a quedar disponible). */
export async function voidAdvanceApplicationAction(movementId: string, reason: string): Promise<void> {
  await requirePermission("payments.void");
  const supabase = await createSupabaseClient();
  const { data: mov } = await supabase
    .from("customer_advance_movements")
    .select("advance_id, invoice_id")
    .eq("id", movementId)
    .single();
  const { error } = await supabase.rpc("void_customer_advance_application", { p_movement_id: movementId, p_reason: reason });
  if (error) throw new Error(advanceErrorMessage(error.message));
  if (mov?.invoice_id) revalidatePath(`/invoices/${mov.invoice_id}`);
  if (mov?.advance_id) {
    const a = await getAdvance(mov.advance_id);
    revalidateAll(a);
  }
  revalidatePath("/invoices");
}

/** Devolver al cliente todo o parte de lo disponible (sale del banco). */
export async function refundAdvanceAction(
  advanceId: string,
  _prev: AdvanceActionState,
  formData: FormData,
): Promise<AdvanceActionState> {
  await requirePermission("payments.void");
  const amount = Number(String(formData.get("amount") ?? "0").replace(/,/g, ""));
  const accountId = String(formData.get("bank_account_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const date = String(formData.get("refund_date") ?? "");
  const accountAmountRaw = String(formData.get("account_amount") ?? "").replace(/,/g, "");
  if (!(amount > 0)) return { error: "Escribe cuánto se le devuelve al cliente." };
  if (!accountId) return { error: "Elige la cuenta de donde sale la devolución." };
  if (reason.length < 3) return { error: "Escribe el motivo de la devolución (ej. «Evento cancelado por el cliente»)." };

  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("refund_customer_advance", {
    p_advance_id: advanceId,
    p_amount: amount,
    p_date: date || todayISO(),
    p_bank_account_id: accountId,
    p_reason: reason,
    p_account_amount: accountAmountRaw ? Number(accountAmountRaw) : null,
    p_confirm_overdraft: overdraftConfirmed(formData),
  });
  if (error) {
    const rule = bankRuleState(error.message);
    if (rule) return rule;
    return { error: advanceErrorMessage(error.message) };
  }
  const a = await getAdvance(advanceId);
  revalidateAll(a ? { ...a, id: advanceId } : { project_id: null, quotation_id: null, id: advanceId });
  return {
    error: null,
    successTitle: "Devolución registrada",
    success: `Se registró la devolución de ${formatMoney(amount, a?.currency ?? "DOP")} al cliente. Ya salió de la cuenta en Bancos (categoría «Devolución a cliente»).`,
    successId: Date.now(),
  };
}

/** Pasar el anticipo a otro proyecto o cotización del mismo cliente (no mueve dinero). */
export async function transferAdvanceAction(
  advanceId: string,
  _prev: AdvanceActionState,
  formData: FormData,
): Promise<AdvanceActionState> {
  await requirePermission("payments.void");
  const target = parseTarget(String(formData.get("target") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!target) return { error: "Elige a dónde pasar el anticipo." };
  if (reason.length < 3) return { error: "Escribe el motivo (ej. «El cliente cambió la fecha del evento»)." };
  const before = await getAdvance(advanceId);
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("transfer_customer_advance", {
    p_advance_id: advanceId,
    p_project_id: target.projectId,
    p_quotation_id: target.quotationId,
    p_reason: reason,
  });
  if (error) return { error: advanceErrorMessage(error.message) };
  const after = await getAdvance(advanceId);
  revalidateAll(before);
  revalidateAll(after ? { ...after, id: advanceId } : null);
  return {
    error: null,
    successTitle: "Anticipo pasado",
    success: "Listo: el anticipo ahora está en su nuevo destino. No se movió dinero; queda anotado en el historial.",
    successId: Date.now(),
  };
}

/** Datos del recibo de anticipo (ANT-0001). El PDF se arma en el navegador. */
export async function getAdvanceReceiptDataAction(
  advanceId: string,
): Promise<{ data: AdvanceReceiptPdfData | null; error: string | null }> {
  await requirePermission("payments.view");
  const supabase = await createSupabaseClient();
  const a = await getAdvance(advanceId);
  if (!a) return { data: null, error: "Anticipo no encontrado." };

  const [{ data: company }, { data: client }] = await Promise.all([
    supabase
      .from("companies")
      .select("name, legal_name, tax_id, logo_url, brand_primary, brand_accent")
      .eq("id", await companyId())
      .single(),
    supabase.from("clients").select("name, tax_id, email, phone").eq("id", a.client_id).single(),
  ]);

  // Total cotizado: las cotizaciones aprobadas del proyecto (misma moneda) o la cotización.
  let totalQuoted: number | null = null;
  let targetLabel = "Anticipo del cliente (sin cotización ni proyecto)";
  if (a.project_id) {
    const [{ data: qs }, { data: p }] = await Promise.all([
      supabase.from("quotations").select("total, currency").eq("project_id", a.project_id).eq("status", "APPROVED"),
      supabase.from("projects").select("number, name").eq("id", a.project_id).single(),
    ]);
    const same = (qs ?? []).filter((q) => q.currency === a.currency);
    totalQuoted = same.length ? same.reduce((acc, q) => acc + Number(q.total), 0) : null;
    targetLabel = p ? `Proyecto ${p.number} — ${p.name}` : "Proyecto";
  } else if (a.quotation_id) {
    const { data: q } = await supabase.from("quotations").select("number, total, currency").eq("id", a.quotation_id).single();
    totalQuoted = q && q.currency === a.currency ? Number(q.total) : null;
    targetLabel = q ? `Cotización ${q.number}` : "Cotización";
  }
  const received = await receivedToDateFor(a);
  // Cobros de facturas del mismo proyecto o cotización (dinero + retenciones), en la misma moneda.
  let paidInvoices = 0;
  if (a.project_id || a.quotation_id) {
    const { data: cobros } = await supabase
      .from("customer_payments")
      .select("amount, amount_applied, currency, invoices!inner(project_id, quotation_id, status)")
      .eq("currency", a.currency)
      .eq(a.project_id ? "invoices.project_id" : "invoices.quotation_id", (a.project_id ?? a.quotation_id) as string)
      .neq("invoices.status", "CANCELLED");
    paidInvoices = (cobros ?? []).reduce((acc, c) => acc + Number(c.amount_applied ?? c.amount), 0);
  }
  const summary = advanceReceiptSummary(totalQuoted, received, paidInvoices);
  const bank = a.bank_accounts as { name: string; bank_name: string | null } | { name: string; bank_name: string | null }[] | null;

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
      advance: {
        number: a.number,
        receipt_date: a.receipt_date,
        amount: Number(a.amount),
        currency: a.currency,
        method: a.method,
        reference: a.reference,
        before_cutoff: a.before_cutoff,
        applied_amount: Number(a.applied_amount),
        refunded_amount: Number(a.refunded_amount),
        available_amount: Number(a.available_amount),
      },
      client: client ?? { name: "Cliente", tax_id: null, email: null, phone: null },
      bankAccount: (Array.isArray(bank) ? bank[0] : bank) ?? null,
      targetLabel,
      summary,
    },
    error: null,
  };
}

/** Sube el PDF del recibo de anticipo a Storage y devuelve un link (7 días). */
export async function uploadAdvanceReceiptAction(
  advanceId: string,
  pdfBase64: string,
): Promise<{ url: string | null; error: string | null }> {
  await requirePermission("payments.view");
  const supabase = await createSupabaseClient();
  const path = `${await companyId()}/receipts/customer-advance-${advanceId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, Buffer.from(pdfBase64, "base64"), { contentType: "application/pdf", upsert: true });
  if (uploadError) return { url: null, error: uploadError.message };
  const { data: signed, error } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error || !signed) return { url: null, error: error?.message ?? "No se pudo generar el link." };
  return { url: signed.signedUrl, error: null };
}
