"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import {
  customerPaymentSchema,
  foreignPaymentErrorState,
  foreignPaymentRpcParams,
  parseForeignPayment,
  registerPaymentSchema,
} from "./schema";
import {
  parseWithholdings,
  withholdingErrorMessage,
  withholdingsRpcParam,
  WITHHOLDING_TYPE_LABELS,
} from "./withholdings";
import type { ReceiptPdfData } from "@/lib/pdf/receipt-document";
import { bankRuleState, overdraftConfirmed, type MoneyActionState } from "@/lib/utils/bank-errors";
import { formatMoney } from "@/lib/utils/money";
import type { SupplierReceiptPdfData } from "@/lib/pdf/supplier-receipt-document";

/** confirmOverdraft: ver features/banks/actions.ts (sobregiro por confirmar). */
export type ActionState = MoneyActionState;
/**
 * Registrar un cobro. Toda la lógica multi-tabla (factura, banco, auditoría)
 * vive en la función Postgres `register_customer_payment` (transaccional,
 * ver F0-Arquitectura sección H). Este Server Action solo valida el form y
 * la llama — no reimplementa los pasos en JS para no romper la atomicidad.
 *
 * Categoría: opcional. Si el usuario no elige otra, el movimiento de banco
 * queda como "Cobro de factura" (lo asigna la base de datos).
 */
export async function registerPaymentAction(
  invoiceId: string,
  clientId: string,
  projectId: string | null,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("payments.create"); // capa de aplicación; la función RPC también lo exige

  const parsed = customerPaymentSchema.safeParse({
    bank_account_id: String(formData.get("bank_account_id") ?? ""),
    payment_date: String(formData.get("payment_date") ?? ""),
    amount: String(formData.get("amount") ?? "0"),
    method: String(formData.get("method") ?? "TRANSFER"),
    reference: String(formData.get("reference") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    category_id: String(formData.get("category_id") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  // Retenciones del cliente (migración 083): llegan como JSON del formulario.
  const wh = formData.get("has_withholdings") === "1" ? parseWithholdings(String(formData.get("withholdings") ?? "")) : parseWithholdings(null);
  if (!wh.success) return { error: wh.error.issues[0]?.message ?? "Revisa las retenciones." };
  const withholdings = wh.data;
  const received = parsed.data.amount;
  if (received <= 0 && withholdings.length === 0) {
    return { error: "Escribe el monto recibido en banco (o agrega la retención del cliente)." };
  }
  if (received > 0 && !parsed.data.bank_account_id) {
    return { error: "Elige la cuenta donde entró el dinero." };
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

  // Multimoneda V5 (paso 3): si la cuenta está en otra moneda que la
  // factura, llegan los datos del bloque "Cobro en moneda diferente"
  // (lo que realmente entró al banco y la tasa). La base de datos
  // recalcula todo y deja el banco en la moneda de la cuenta.
  const fx = parseForeignPayment(formData);
  if (!fx.success) return { error: fx.error.issues[0]?.message ?? "Datos del cobro en otra moneda inválidos." };

  const { error } = await supabase.rpc("register_customer_payment", {
    p_company_id: companyIds[0],
    p_client_id: clientId,
    p_invoice_id: invoiceId,
    p_project_id: projectId,
    // Solo retención (recibido 0): sin cuenta ni movimiento de banco.
    p_bank_account_id: received > 0 ? parsed.data.bank_account_id || null : null,
    p_payment_date: parsed.data.payment_date,
    p_amount: received,
    p_method: parsed.data.method,
    p_reference: parsed.data.reference || null,
    p_currency: invoice.currency,
    p_exchange_rate: invoice.exchange_rate,
    p_notes: parsed.data.notes || null,
    // Vacío = null: la base de datos pone "Cobro de factura" automáticamente.
    p_category_id: parsed.data.category_id || null,
    ...(received > 0 ? foreignPaymentRpcParams(fx.data) : {}),
    p_withholdings: withholdingsRpcParam(withholdings),
  });

  if (error) {
    const fxState = foreignPaymentErrorState(error.message, "COBRO");
    if (fxState) return fxState;
    const whMessage = withholdingErrorMessage(error.message);
    if (whMessage) return { error: whMessage };
    // Traducir los errores conocidos de la función a mensajes claros
    if (error.message.includes("amount_exceeds_balance")) {
      return {
        error: null,
        blockedTitle: "Monto mayor a lo pendiente",
        blocked: withholdings.length
          ? "El dinero recibido más las retenciones supera lo que falta por cobrar de esta factura. Revisa los montos e inténtalo de nuevo."
          : "El monto que escribiste es mayor a lo que falta por cobrar de esta factura. Revisa el monto e inténtalo de nuevo.",
      };
    }
    if (error.message.includes("bank_account_required")) {
      return { error: "Elige la cuenta donde entró el dinero." };
    }
    if (error.message.includes("invalid_status")) {
      return { error: "Esta factura no admite cobros en su estado actual." };
    }
    if (error.message.includes("category_not_found")) {
      return { error: "La categoría elegida no existe. Recarga la página e inténtalo de nuevo." };
    }
    if (error.message.includes("client_mismatch")) {
      return { error: "El cliente del cobro no coincide con el de la factura. Recarga la página e inténtalo de nuevo." };
    }
    if (error.message.includes("invalid_account_type")) {
      return { error: "No se puede recibir un cobro en una tarjeta de crédito. Elige una cuenta bancaria." };
    }
    if (error.message.includes("invalid_amount")) {
      const i = error.message.indexOf("invalid_amount:");
      return { error: error.message.slice(i + 15).trim() };
    }
    return { error: error.message };
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/payments");

  const whTotal = Math.round(withholdings.reduce((a, w) => a + w.amount, 0) * 100) / 100;
  const whText = whTotal
    ? `${received > 0 ? " y " : ""}retenciones del cliente por ${formatMoney(whTotal, invoice.currency)} (${withholdings
        .map((w) => WITHHOLDING_TYPE_LABELS[w.type])
        .join(", ")})`
    : "";
  if (received <= 0) {
    return {
      error: null,
      successTitle: "Retención aplicada",
      success: `Se aplicaron ${whText.trim()} a la factura. No entró dinero al banco.`,
      successId: Date.now(),
    };
  }
  const { data: account } = await supabase
    .from("bank_accounts")
    .select("name, currency")
    .eq("id", parsed.data.bank_account_id!)
    .single();
  const foreign = account && account.currency !== invoice.currency && fx.data.account_amount;
  return {
    error: null,
    successTitle: "Cobro registrado",
    success: `Se registró el cobro de ${formatMoney(received, invoice.currency)}${
      account ? ` en ${account.name}` : ""
    }${
      foreign
        ? ` (entraron ${formatMoney(fx.data.account_amount!, account.currency)}${
            fx.data.bank_fee ? `; comisión del banco ${formatMoney(fx.data.bank_fee, account.currency)} registrada aparte` : ""
          })`
        : ""
    }${whText}. Ya se ve en la factura y en Bancos.`,
    successId: Date.now(),
  };
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

  // Multimoneda V5: si la cuenta está en otra moneda, llegan los datos del
  // bloque "Pago en moneda diferente" (la base de datos recalcula todo).
  const fx = parseForeignPayment(formData);
  if (!fx.success) return { error: fx.error.issues[0]?.message ?? "Datos del pago en otra moneda inválidos." };

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
    p_confirm_overdraft: overdraftConfirmed(formData),
    ...foreignPaymentRpcParams(fx.data),
  });

  if (error) {
    // Fondos insuficientes / sobregiro por confirmar (reglas de cuentas, migración 063)
    const rule = bankRuleState(error.message);
    if (rule) return rule;
    const fxState = foreignPaymentErrorState(error.message);
    if (fxState) return fxState;
    if (error.message.includes("amount_exceeds_balance")) {
      return {
        error: null,
        blockedTitle: "Monto mayor a lo pendiente",
        blocked: "El monto que escribiste es mayor a lo que falta por pagar de este gasto. Revisa el monto e inténtalo de nuevo.",
      };
    }
    if (error.message.includes("invalid_status")) {
      return { error: "Este gasto no admite pagos en su estado actual." };
    }
    if (error.message.includes("supplier_required")) {
      return {
        error: null,
        blockedTitle: "Falta el proveedor",
        blocked: "Para pagar este gasto primero asígnale un proveedor: abre «Editar gasto», elige el proveedor y guarda. (Solo los incentivos por proyecto se pagan sin proveedor.)",
      };
    }
    if (error.message.includes("inactive_account")) {
      return { error: "Esa cuenta o tarjeta está inactiva. Actívala en Bancos o elige otra." };
    }
    return { error: error.message };
  }

  revalidatePath(`/expenses/${expenseId}`);
  revalidatePath("/expenses");
  revalidatePath("/payments");

  const { data: account } = await supabase
    .from("bank_accounts")
    .select("name, currency")
    .eq("id", parsed.data.bank_account_id)
    .single();
  const foreign = account && account.currency !== expense.currency && fx.data.account_amount;
  return {
    error: null,
    successTitle: "Pago registrado",
    success: `Se registró el pago de ${formatMoney(parsed.data.amount, expense.currency)}${
      account ? ` desde ${account.name}` : ""
    }${
      foreign
        ? ` (la cuenta bajó ${formatMoney(fx.data.account_amount! + (fx.data.bank_fee ?? 0), account.currency)}${fx.data.bank_fee ? ", comisión incluida" : ""})`
        : ""
    }. Ya se ve en el gasto y en Bancos.`,
    successId: Date.now(),
  };
}

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

/**
 * Obtiene los datos necesarios para renderizar el PDF del recibo de un
 * cobro (customer_payments). El render (`pdf()` de @react-pdf/renderer) se
 * hace en el navegador — ver `getInvoicePdfDataAction` en
 * features/invoices/actions.ts para el porqué.
 */
/**
 * Balance pendiente del documento JUSTO DESPUÉS de este pago (para el
 * comprobante): el balance de hoy más lo que se pagó después. Así el
 * comprobante de un pago parcial sigue diciendo lo que faltaba en ese
 * momento, aunque luego se haya pagado el resto.
 */
type PaymentRow = { id: string; amount: number; amount_applied?: number | null; payment_date: string; created_at: string };
function balanceAfterPayment(currentBalance: number, rows: PaymentRow[], paymentId: string) {
  const key = (r: PaymentRow) => `${r.payment_date}|${r.created_at}|${r.id}`;
  const me = rows.find((r) => r.id === paymentId);
  if (!me) return currentBalance;
  // Lo que rebajó el saldo cada cobro posterior: dinero + retenciones activas.
  const later = rows.filter((r) => key(r) > key(me)).reduce((a, r) => a + Number(r.amount_applied ?? r.amount), 0);
  return Math.round((currentBalance + later) * 100) / 100;
}

export async function getPaymentReceiptDataAction(
  paymentId: string,
): Promise<{ data: ReceiptPdfData | null; error: string | null }> {
  await requirePermission("payments.create");

  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  const [{ data: payment, error: pError }, { data: company }] = await Promise.all([
    supabase
      .from("customer_payments")
      .select(
        "id, status, void_reason, invoice_id, payment_date, amount, withholding_total, amount_applied, method, reference, currency, invoices(number, balance), clients(name, tax_id, email, phone), bank_accounts(name, bank_name), customer_payment_withholdings(withholding_type, amount, currency, certificate_amount, certificate_currency, certificate_number, status, voided_at, void_reason)",
      )
      .eq("id", paymentId)
      .single(),
    supabase
      .from("companies")
      .select("name, legal_name, tax_id, logo_url, brand_primary, brand_accent")
      .eq("id", companyId)
      .single(),
  ]);

  if (pError || !payment) return { data: null, error: pError?.message ?? "Cobro no encontrado." };

  type One<T> = T | T[] | null;
  const invoiceData = payment.invoices as One<{ number: string; balance: number }>;
  const invoiceNow = Array.isArray(invoiceData) ? invoiceData[0] : invoiceData;
  const [{ data: invoicePayments }, { data: advanceApplications }] = await Promise.all([
    supabase
      .from("customer_payments")
      .select("id, amount, amount_applied, payment_date, created_at")
      .eq("invoice_id", payment.invoice_id)
      .eq("status", "ACTIVE"),
    // Anticipos aplicados (V1-3) también rebajan el saldo: cuentan si se aplicaron después de este cobro.
    supabase
      .from("customer_advance_movements")
      .select("id, amount, movement_date, created_at")
      .eq("invoice_id", payment.invoice_id)
      .eq("kind", "APPLY")
      .eq("status", "ACTIVE"),
  ]);
  const allRows = [
    ...(invoicePayments ?? []),
    ...(advanceApplications ?? []).map((m) => ({
      id: m.id,
      amount: Number(m.amount),
      amount_applied: Number(m.amount),
      payment_date: m.movement_date,
      created_at: m.created_at,
    })),
  ];
  const invoice = invoiceNow
    ? { ...invoiceNow, balance: balanceAfterPayment(Number(invoiceNow.balance), allRows, payment.id) }
    : null;
  const clientData = payment.clients as One<{
    name: string;
    tax_id: string | null;
    email: string | null;
    phone: string | null;
  }>;
  const client = Array.isArray(clientData) ? clientData[0] : clientData;
  const bankData = payment.bank_accounts as One<{ name: string; bank_name: string | null }>;
  const bankAccount = Array.isArray(bankData) ? bankData[0] : bankData;

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
      payment,
      invoice: invoice ?? { number: "—", balance: 0 },
      client: client ?? { name: "Cliente", tax_id: null, email: null, phone: null },
      bankAccount: bankAccount ?? null,
    },
    error: null,
  };
}

/**
 * Sube el PDF del recibo de cobro (ya renderizado en el navegador) a
 * Storage y devuelve una URL firmada (7 días).
 */
export async function uploadPaymentReceiptAction(
  paymentId: string,
  pdfBase64: string,
): Promise<{ url: string | null; error: string | null }> {
  await requirePermission("payments.create");

  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();
  const buffer = Buffer.from(pdfBase64, "base64");

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
 * Obtiene los datos necesarios para renderizar el PDF del comprobante de un
 * pago a proveedor (supplier_payments). El render se hace en el navegador.
 */
export async function getSupplierPaymentReceiptDataAction(
  paymentId: string,
): Promise<{ data: SupplierReceiptPdfData | null; error: string | null }> {
  await requirePermission("payments.create");

  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  const [{ data: payment, error: pError }, { data: company }] = await Promise.all([
    supabase
      .from("supplier_payments")
      .select(
        "id, status, void_reason, expense_id, payment_date, amount, method, reference, currency, payee_bank_name, expenses(description, balance, total, ncf, isr_withheld, itbis_withheld, total_withheld, net_payable, incentive_recipient), suppliers(name, tax_id, email, phone), bank_accounts(name, bank_name)",
      )
      .eq("id", paymentId)
      .single(),
    supabase
      .from("companies")
      .select("name, legal_name, tax_id, logo_url, brand_primary, brand_accent")
      .eq("id", companyId)
      .single(),
  ]);

  if (pError || !payment) return { data: null, error: pError?.message ?? "Pago no encontrado." };

  type One<T> = T | T[] | null;
  type ExpenseData = {
    description: string;
    balance: number;
    total: number;
    ncf: string | null;
    isr_withheld: number | null;
    itbis_withheld: number | null;
    total_withheld: number | null;
    net_payable: number | null;
    incentive_recipient: string | null;
  };
  const expenseData = payment.expenses as One<ExpenseData>;
  const rawExpense = Array.isArray(expenseData) ? expenseData[0] : expenseData;
  const { data: expensePayments } = await supabase
    .from("supplier_payments")
    .select("id, amount, payment_date, created_at")
    .eq("expense_id", payment.expense_id)
    .eq("status", "ACTIVE");
  // Retenciones del gasto (migración 074): el comprobante muestra cómo se
  // llegó al neto que se le paga al proveedor.
  const expense = rawExpense
    ? {
        description: rawExpense.description,
        // Lo que faltaba justo después de ESTE pago (no el balance de hoy).
        balance: balanceAfterPayment(Number(rawExpense.balance), expensePayments ?? [], payment.id),
        total: Number(rawExpense.total ?? 0),
        ncf: rawExpense.ncf ?? null,
        isrWithheld: Number(rawExpense.isr_withheld ?? 0),
        itbisWithheld: Number(rawExpense.itbis_withheld ?? 0),
        totalWithheld: Number(rawExpense.total_withheld ?? 0),
        netPayable: Number(rawExpense.net_payable ?? rawExpense.total ?? 0),
      }
    : null;
  const supplierData = payment.suppliers as One<{
    name: string;
    tax_id: string | null;
    email: string | null;
    phone: string | null;
  }>;
  const supplier = Array.isArray(supplierData) ? supplierData[0] : supplierData;
  const bankData = payment.bank_accounts as One<{ name: string; bank_name: string | null }>;
  const bankAccount = Array.isArray(bankData) ? bankData[0] : bankData;

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
      payment,
      expense: expense ?? { description: "—", balance: 0 },
      // V1-2: un incentivo no tiene proveedor: el recibo dice a quién se le pagó.
      supplier: supplier ?? { name: rawExpense?.incentive_recipient ?? "Proveedor", tax_id: null, email: null, phone: null },
      bankAccount: bankAccount ?? null,
    },
    error: null,
  };
}

/**
 * Sube el PDF del comprobante de pago a proveedor (ya renderizado en el
 * navegador) a Storage y devuelve una URL firmada (7 días).
 */
export async function uploadSupplierPaymentReceiptAction(
  paymentId: string,
  pdfBase64: string,
): Promise<{ url: string | null; error: string | null }> {
  await requirePermission("payments.create");

  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();
  const buffer = Buffer.from(pdfBase64, "base64");

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

/**
 * Retención del cliente — agregar el certificado después (número, monto en
 * RD$ si la factura es en otra moneda, nota y el archivo). No toca montos:
 * la base de datos (update_customer_withholding_support) lo audita.
 */
export async function updateWithholdingSupportAction(
  withholdingId: string,
  invoiceId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("payments.create");
  const supabase = await createSupabaseClient();
  const companyId = await getPrimaryCompanyId();

  const certificateNumber = String(formData.get("certificate_number") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const certRaw = String(formData.get("certificate_amount") ?? "").replace(/,/g, "").trim();
  const certificateAmount = certRaw ? Number(certRaw) : null;
  if (certificateAmount !== null && !(certificateAmount > 0)) {
    return { error: "El monto del certificado debe ser mayor a 0." };
  }

  // Archivo del certificado (opcional): se guarda en Documentos de la factura.
  let documentId: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 15 * 1024 * 1024) return { error: "El archivo no puede superar 15MB." };
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${companyId}/invoice/${invoiceId}/${Date.now()}-retencion-${safeName}`;
    const { error: upError } = await supabase.storage
      .from("documents")
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "application/octet-stream" });
    if (upError) return { error: `No se pudo subir el archivo: ${upError.message}` };
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .insert({
        company_id: companyId,
        entity_type: "invoice",
        entity_id: invoiceId,
        file_name: `Certificado de retención — ${file.name}`,
        storage_path: path,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        uploaded_by: user?.id,
      })
      .select("id")
      .single();
    if (docError || !doc) {
      await supabase.storage.from("documents").remove([path]);
      return { error: docError?.message ?? "No se pudo guardar el archivo." };
    }
    documentId = doc.id;
  }

  if (!certificateNumber && !notes && certificateAmount === null && !documentId) {
    return { error: "Escribe el número del certificado o adjunta el archivo." };
  }

  const { error } = await supabase.rpc("update_customer_withholding_support", {
    p_withholding_id: withholdingId,
    p_certificate_number: certificateNumber || null,
    p_certificate_amount: certificateAmount,
    p_reference: null,
    p_notes: notes || null,
    p_document_id: documentId,
  });
  if (error) {
    if (error.message.includes("invalid_status")) return { error: "La retención está anulada." };
    return { error: error.message };
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/reports");
  return { error: null, success: "Certificado guardado.", successId: Date.now() };
}

/**
 * Anular una retención del cliente: motivo obligatorio, nunca se borra y no
 * toca el banco. La factura vuelve a tener ese saldo por cobrar. Permiso
 * payments.void (Administrador y Finanzas por defecto).
 */
export async function voidWithholdingAction(
  withholdingId: string,
  invoiceId: string,
  reason: string,
): Promise<{ error: string | null }> {
  await requirePermission("payments.void");
  const supabase = await createSupabaseClient();
  const clean = reason.trim();
  if (clean.length < 10) return { error: "Escribe el motivo de la anulación (mínimo 10 letras)." };
  const { error } = await supabase.rpc("void_customer_withholding", {
    p_withholding_id: withholdingId,
    p_reason: clean,
  });
  if (error) {
    if (error.message.includes("invalid_status")) {
      const i = error.message.indexOf("invalid_status:");
      return { error: `No se puede anular: ${error.message.slice(i + 15).trim()}.` };
    }
    if (error.message.includes("insufficient_privilege")) {
      return { error: "No tienes permiso para anular retenciones." };
    }
    return { error: error.message };
  }
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/reports");
  return { error: null };
}
