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
    tax: String(formData.get("tax") ?? "0"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const subtotal = calculateInvoiceItemSubtotal(parsed.data);
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("invoice_items").insert({
    invoice_id: invoiceId,
    service_id: parsed.data.service_id || null,
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    unit_price: parsed.data.unit_price,
    discount: parsed.data.discount,
    tax: parsed.data.tax,
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
