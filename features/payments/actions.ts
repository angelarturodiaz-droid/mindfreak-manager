"use server";

import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { registerPaymentSchema } from "./schema";
import { ReceiptPdfDocument } from "@/lib/pdf/receipt-document";
import { SupplierReceiptPdfDocument } from "@/lib/pdf/supplier-receipt-document";

export type ActionState = { error: string | null };
/**
 * Registrar un cobro. Toda la lógica multi-tabla (factura, banco, auditoría)
 * vive en la función Postgres `register_customer_payment` (transaccional,
 * ver F0-Arquitectura sección H). Este Server Action solo valida el form y
 * la llama — no reimplementa los pasos en JS para no romper la atomicidad.
 */
export async function registerPaymentAction(
  invoiceId: string,
  clientId: string,
  projectId: string | null,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("payments.create"); // capa de aplicación; la función RPC también lo exige

  const parsed = registerPaymentSchema.safeParse({
    bank_account_id: String(formData.get("bank_account_id") ?? ""),
    payment_date: String(formData.get("payment_date") ?? ""),
    amount: String(formData.get("amount") ?? "0"),
    method: String(formData.get("method") ?? "TRANSFER"),
    reference: String(formData.get("reference") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    return { error: "Tu usuario no está asignado a ninguna compañía." };
  }

  const supabase = await createSupabaseClient();
  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select("currency, exchange_rate")
    .eq("id", invoiceId)
    .single();
  if (invError || !invoice) return { error: "Factura no encontrada." };

  const { error } = await supabase.rpc("register_customer_payment", {
    p_company_id: companyIds[0],
    p_client_id: clientId,
    p_invoice_id: invoiceId,
    p_project_id: projectId,
    p_bank_account_id: parsed.data.bank_account_id,
    p_payment_date: parsed.data.payment_date,
    p_amount: parsed.data.amount,
    p_method: parsed.data.method,
    p_reference: parsed.data.reference || null,
    p_currency: invoice.currency,
    p_exchange_rate: invoice.exchange_rate,
    p_notes: parsed.data.notes || null,
  });

  if (error) {
    // Traducir los errores conocidos de la función a mensajes claros
    if (error.message.includes("amount_exceeds_balance")) {
      return { error: "El monto supera el balance pendiente de la factura." };
    }
    if (error.message.includes("invalid_status")) {
      return { error: "Esta factura no admite cobros en su estado actual." };
    }
    return { error: error.message };
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/payments");
  return { error: null };
}

/**
 * Registrar un pago a proveedor. Igual que `registerPaymentAction` (cobros):
 * toda la lógica multi-tabla vive en la función Postgres
 * `register_supplier_payment` (transaccional, F0-Arquitectura sección H).
 */
export async function registerSupplierPaymentAction(
  expenseId: string,
  supplierId: string | null,
  projectId: string | null,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("payments.create");

  const parsed = registerPaymentSchema.safeParse({
    bank_account_id: String(formData.get("bank_account_id") ?? ""),
    payment_date: String(formData.get("payment_date") ?? ""),
    amount: String(formData.get("amount") ?? "0"),
    method: String(formData.get("method") ?? "TRANSFER"),
    reference: String(formData.get("reference") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    return { error: "Tu usuario no está asignado a ninguna compañía." };
  }

  const supabase = await createSupabaseClient();
  const { data: expense, error: expError } = await supabase
    .from("expenses")
    .select("currency, exchange_rate")
    .eq("id", expenseId)
    .single();
  if (expError || !expense) return { error: "Gasto no encontrado." };

  const payeeBankName = String(formData.get("payee_bank_name") ?? "").trim() || null;

  const { error } = await supabase.rpc("register_supplier_payment", {
    p_company_id: companyIds[0],
    p_supplier_id: supplierId,
    p_expense_id: expenseId,
    p_project_id: projectId,
    p_bank_account_id: parsed.data.bank_account_id,
    p_payment_date: parsed.data.payment_date,
    p_amount: parsed.data.amount,
    p_method: parsed.data.method,
    p_reference: parsed.data.reference || null,
    p_currency: expense.currency,
    p_exchange_rate: expense.exchange_rate,
    p_notes: parsed.data.notes || null,
    p_payee_bank_name: payeeBankName,
  });

  if (error) {
    if (error.message.includes("amount_exceeds_balance")) {
      return { error: "El monto supera el balance pendiente del gasto." };
    }
    if (error.message.includes("invalid_status")) {
      return { error: "Este gasto no admite pagos en su estado actual." };
    }
    return { error: error.message };
  }

  revalidatePath(`/expenses/${expenseId}`);
  revalidatePath("/expenses");
  revalidatePath("/payments");
  return { error: null };
}

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

/**
 * Genera el PDF del recibo de un cobro específico (customer_payments) y
 * devuelve un link firmado de 7 días — mismo patrón que las cotizaciones/
 * facturas.
 */
export async function generatePaymentReceiptAction(
  paymentId: string,
): Promise<{ url: string | null; error: string | null }> {
  await requirePermission("payments.create");

  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  const [{ data: payment, error: pError }, { data: company }] = await Promise.all([
    supabase
      .from("customer_payments")
      .select(
        "id, payment_date, amount, method, reference, currency, invoices(number, balance), clients(name, tax_id, email, phone), bank_accounts(name, bank_name)",
      )
      .eq("id", paymentId)
      .single(),
    supabase
      .from("companies")
      .select("name, legal_name, tax_id, logo_url, brand_primary, brand_accent")
      .eq("id", companyId)
      .single(),
  ]);

  if (pError || !payment) return { url: null, error: pError?.message ?? "Cobro no encontrado." };

  type One<T> = T | T[] | null;
  const invoiceData = payment.invoices as One<{ number: string; balance: number }>;
  const invoice = Array.isArray(invoiceData) ? invoiceData[0] : invoiceData;
  const clientData = payment.clients as One<{
    name: string;
    tax_id: string | null;
    email: string | null;
    phone: string | null;
  }>;
  const client = Array.isArray(clientData) ? clientData[0] : clientData;
  const bankData = payment.bank_accounts as One<{ name: string; bank_name: string | null }>;
  const bankAccount = Array.isArray(bankData) ? bankData[0] : bankData;

  const buffer = await renderToBuffer(
    ReceiptPdfDocument({
      company: company ?? {
        name: "Mindfreak Manager",
        legal_name: null,
        tax_id: null,
        logo_url: null,
        brand_primary: "#0b0e14",
        brand_accent: "#17a6b8",
      },
      payment,
      invoice: invoice ?? { number: "—", balance: 0 },
      client: client ?? { name: "Cliente", tax_id: null, email: null, phone: null },
      bankAccount: bankAccount ?? null,
    }),
  );

  const path = `${companyId}/receipts/customer-payment-${paymentId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) return { url: null, error: uploadError.message };

  const { data: signed, error: signError } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signError || !signed) {
    return { url: null, error: signError?.message ?? "No se pudo generar el link." };
  }

  return { url: signed.signedUrl, error: null };
}

/**
 * Genera el PDF del comprobante de un pago a proveedor (supplier_payments).
 */
export async function generateSupplierPaymentReceiptAction(
  paymentId: string,
): Promise<{ url: string | null; error: string | null }> {
  await requirePermission("payments.create");

  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  const [{ data: payment, error: pError }, { data: company }] = await Promise.all([
    supabase
      .from("supplier_payments")
      .select(
        "id, payment_date, amount, method, reference, currency, payee_bank_name, expenses(description, balance), suppliers(name, tax_id, email, phone), bank_accounts(name, bank_name)",
      )
      .eq("id", paymentId)
      .single(),
    supabase
      .from("companies")
      .select("name, legal_name, tax_id, logo_url, brand_primary, brand_accent")
      .eq("id", companyId)
      .single(),
  ]);

  if (pError || !payment) return { url: null, error: pError?.message ?? "Pago no encontrado." };

  type One<T> = T | T[] | null;
  const expenseData = payment.expenses as One<{ description: string; balance: number }>;
  const expense = Array.isArray(expenseData) ? expenseData[0] : expenseData;
  const supplierData = payment.suppliers as One<{
    name: string;
    tax_id: string | null;
    email: string | null;
    phone: string | null;
  }>;
  const supplier = Array.isArray(supplierData) ? supplierData[0] : supplierData;
  const bankData = payment.bank_accounts as One<{ name: string; bank_name: string | null }>;
  const bankAccount = Array.isArray(bankData) ? bankData[0] : bankData;

  const buffer = await renderToBuffer(
    SupplierReceiptPdfDocument({
      company: company ?? {
        name: "Mindfreak Manager",
        legal_name: null,
        tax_id: null,
        logo_url: null,
        brand_primary: "#0b0e14",
        brand_accent: "#17a6b8",
      },
      payment,
      expense: expense ?? { description: "—", balance: 0 },
      supplier: supplier ?? { name: "Proveedor", tax_id: null, email: null, phone: null },
      bankAccount: bankAccount ?? null,
    }),
  );

  const path = `${companyId}/receipts/supplier-payment-${paymentId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) return { url: null, error: uploadError.message };

  const { data: signed, error: signError } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signError || !signed) {
    return { url: null, error: signError?.message ?? "No se pudo generar el link." };
  }

  return { url: signed.signedUrl, error: null };
}
