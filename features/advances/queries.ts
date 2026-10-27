import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, pageRange } from "@/lib/utils/pagination";
import { idsByName, searchOr } from "@/lib/utils/search";
import { relationRow } from "@/lib/utils/relation";

/**
 * Anticipos de clientes (V1-3, migración 090). Solo lectura: todo lo que
 * escribe pasa por las funciones de la base de datos (features/advances/actions.ts).
 */

const ADVANCE_SELECT =
  "id, number, client_id, project_id, quotation_id, receipt_date, created_at, currency, exchange_rate, amount, applied_amount, refunded_amount, available_amount, before_cutoff, method, reference, notes, bank_account_id, account_currency, account_amount, bank_fee_amount, clients(name), projects(number, name), quotations(number), bank_accounts(name, bank_name)";

export type AdvanceRow = {
  id: string;
  number: string;
  client_id: string;
  project_id: string | null;
  quotation_id: string | null;
  receipt_date: string;
  created_at: string;
  currency: string;
  exchange_rate: number;
  amount: number;
  applied_amount: number;
  refunded_amount: number;
  available_amount: number;
  before_cutoff: boolean;
  method: string | null;
  reference: string | null;
  notes: string | null;
  bank_account_id: string | null;
  account_currency: string | null;
  account_amount: number | null;
  bank_fee_amount: number | null;
  clients: unknown;
  projects: unknown;
  quotations: unknown;
  bank_accounts: unknown;
};

/** «PROJ-0005», «COT-0016» o «Solo el cliente», para mostrar a qué va ligado. */
export function advanceTargetOf(a: Pick<AdvanceRow, "project_id" | "quotation_id" | "projects" | "quotations">) {
  const project = relationRow<{ number: string; name: string }>(a.projects);
  const quotation = relationRow<{ number: string }>(a.quotations);
  if (a.project_id && project) return { kind: "project" as const, label: project.number, detail: project.name, href: `/projects/${a.project_id}?tab=ventas` };
  if (a.quotation_id && quotation) return { kind: "quotation" as const, label: quotation.number, detail: "Cotización aprobada", href: `/quotations/${a.quotation_id}` };
  return { kind: "client" as const, label: "Solo el cliente", detail: "Sin cotización ni proyecto", href: null };
}

export async function listProjectAdvances(projectId: string): Promise<AdvanceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_advances")
    .select(ADVANCE_SELECT)
    .eq("project_id", projectId)
    .order("receipt_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdvanceRow[];
}

export async function listQuotationAdvances(quotationId: string): Promise<AdvanceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_advances")
    .select(ADVANCE_SELECT)
    .eq("quotation_id", quotationId)
    .order("receipt_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdvanceRow[];
}

/** Lista de Cobros y pagos → pestaña Anticipos (10 por página). */
export async function listAdvancesPage(filters: { search?: string; page?: number; onlyAvailable?: boolean } = {}) {
  const supabase = await createClient();
  const [from, to] = pageRange(filters.page ?? 1);
  let query = supabase
    .from("customer_advances")
    .select(ADVANCE_SELECT, { count: "exact" })
    .order("receipt_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (filters.onlyAvailable) query = query.gt("available_amount", 0);
  if (filters.search) {
    const ids = await idsByName(supabase, "clients", filters.search);
    query = query.or(searchOr(filters.search, ["number", "reference"], { column: "client_id", ids }));
  }
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as AdvanceRow[], total: count ?? 0, pageSize: PAGE_SIZE };
}

/** Total sin aplicar (en pesos, con la tasa del día del anticipo) y cuántos anticipos. */
export async function getAdvanceTotals() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_advances")
    .select("currency, exchange_rate, available_amount, receipt_date")
    .gt("available_amount", 0);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return {
    sinAplicar: rows.reduce((acc, r) => acc + Number(r.available_amount) * Number(r.exchange_rate ?? 1), 0),
    sinAplicarCount: rows.length,
  };
}

export async function countAdvances() {
  const supabase = await createClient();
  const { count } = await supabase.from("customer_advances").select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function getAdvance(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("customer_advances").select(ADVANCE_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as AdvanceRow | null;
}

export type AdvanceMovementRow = {
  id: string;
  kind: "APPLY" | "REFUND" | "TRANSFER";
  status: "ACTIVE" | "VOIDED";
  movement_date: string;
  created_at: string;
  amount: number | null;
  invoice_id: string | null;
  account_amount: number | null;
  reason: string | null;
  void_reason: string | null;
  voided_at: string | null;
  from_project_id: string | null;
  from_quotation_id: string | null;
  to_project_id: string | null;
  to_quotation_id: string | null;
  invoices: unknown;
  bank_accounts: unknown;
  /** Número del proyecto o cotización de origen y destino (pasar a otro proyecto). */
  fromLabel?: string;
  toLabel?: string;
};

export async function listAdvanceMovements(advanceId: string): Promise<AdvanceMovementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_advance_movements")
    .select(
      "id, kind, status, movement_date, created_at, amount, invoice_id, account_amount, reason, void_reason, voided_at, from_project_id, from_quotation_id, to_project_id, to_quotation_id, invoices(number), bank_accounts(name, currency)",
    )
    .eq("advance_id", advanceId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AdvanceMovementRow[];

  // Números de los proyectos y cotizaciones de los traspasos.
  const projectIds = rows.flatMap((r) => [r.from_project_id, r.to_project_id]).filter((x): x is string => Boolean(x));
  const quotationIds = rows.flatMap((r) => [r.from_quotation_id, r.to_quotation_id]).filter((x): x is string => Boolean(x));
  const [projects, quotations] = await Promise.all([
    projectIds.length ? supabase.from("projects").select("id, number").in("id", projectIds) : Promise.resolve({ data: [] }),
    quotationIds.length ? supabase.from("quotations").select("id, number").in("id", quotationIds) : Promise.resolve({ data: [] }),
  ]);
  const num = new Map<string, string>();
  for (const p of (projects.data ?? []) as { id: string; number: string }[]) num.set(p.id, p.number);
  for (const q of (quotations.data ?? []) as { id: string; number: string }[]) num.set(q.id, q.number);
  const label = (projectId: string | null, quotationId: string | null) =>
    (projectId && num.get(projectId)) || (quotationId && num.get(quotationId)) || "Solo el cliente";
  return rows.map((r) =>
    r.kind === "TRANSFER"
      ? { ...r, fromLabel: label(r.from_project_id, r.from_quotation_id), toLabel: label(r.to_project_id, r.to_quotation_id) }
      : r,
  );
}

/**
 * Anticipos que se pueden aplicar a una factura: mismo cliente y moneda,
 * con saldo disponible, y del mismo proyecto o cotización (o «solo del
 * cliente»). Igual que la regla de apply_customer_advance.
 */
export async function listApplicableAdvances(invoice: {
  client_id: string;
  project_id: string | null;
  quotation_id: string | null;
  currency: string;
}): Promise<AdvanceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_advances")
    .select(ADVANCE_SELECT)
    .eq("client_id", invoice.client_id)
    .eq("currency", invoice.currency)
    .gt("available_amount", 0)
    .order("receipt_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as AdvanceRow[]).filter(
    (a) =>
      (!a.project_id && !a.quotation_id) ||
      (a.project_id && a.project_id === invoice.project_id) ||
      (a.quotation_id && a.quotation_id === invoice.quotation_id),
  );
}

/** Anticipos del cliente en otro proyecto o moneda (para avisar que existen). */
export async function countOtherClientAdvances(clientId: string, excludeIds: string[]) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customer_advances")
    .select("id")
    .eq("client_id", clientId)
    .gt("available_amount", 0);
  return (data ?? []).filter((r) => !excludeIds.includes(r.id)).length;
}

export type AdvanceApplicationRow = {
  id: string;
  status: "ACTIVE" | "VOIDED";
  movement_date: string;
  created_at: string;
  amount: number;
  void_reason: string | null;
  voided_at: string | null;
  advance_id: string;
  customer_advances: unknown;
};

/** Anticipos aplicados a una factura (también los quitados, tachados). */
export async function listInvoiceAdvanceApplications(invoiceId: string): Promise<AdvanceApplicationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_advance_movements")
    .select("id, status, movement_date, created_at, amount, void_reason, voided_at, advance_id, customer_advances(number, receipt_date, currency)")
    .eq("invoice_id", invoiceId)
    .eq("kind", "APPLY")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdvanceApplicationRow[];
}

/**
 * Anticipos de un proyecto en pesos: recibido (menos devuelto), aplicado a
 * sus facturas y lo que queda sin aplicar. Para la tarjeta «Cobrado».
 */
export async function getProjectAdvanceTotals(projectId: string) {
  const supabase = await createClient();
  const [own, applied] = await Promise.all([
    supabase
      .from("customer_advances")
      .select("amount, refunded_amount, available_amount, exchange_rate")
      .eq("project_id", projectId),
    supabase
      .from("customer_advance_movements")
      .select("amount, customer_advances(exchange_rate), invoices!inner(project_id)")
      .eq("kind", "APPLY")
      .eq("status", "ACTIVE")
      .eq("invoices.project_id", projectId),
  ]);
  if (own.error) throw new Error(own.error.message);
  if (applied.error) throw new Error(applied.error.message);
  let recibido = 0;
  let sinAplicar = 0;
  for (const a of own.data ?? []) {
    const rate = Number(a.exchange_rate ?? 1);
    recibido += (Number(a.amount) - Number(a.refunded_amount)) * rate;
    sinAplicar += Math.max(0, Number(a.available_amount)) * rate;
  }
  const aplicado = (applied.data ?? []).reduce((acc, m) => {
    const rate = Number(relationRow<{ exchange_rate: number }>(m.customer_advances)?.exchange_rate ?? 1);
    return acc + Number(m.amount) * rate;
  }, 0);
  return { recibido, aplicado, sinAplicar, count: (own.data ?? []).length };
}

/** Lo recibido (menos devuelto) del mismo proyecto o cotización hasta este anticipo, para el recibo. */
export async function receivedToDateFor(a: Pick<AdvanceRow, "id" | "project_id" | "quotation_id" | "client_id" | "receipt_date" | "created_at" | "currency">) {
  const supabase = await createClient();
  let query = supabase
    .from("customer_advances")
    .select("id, amount, refunded_amount, receipt_date, created_at")
    .eq("currency", a.currency)
    .lte("receipt_date", a.receipt_date);
  if (a.project_id) query = query.eq("project_id", a.project_id);
  else if (a.quotation_id) query = query.eq("quotation_id", a.quotation_id);
  else query = query.eq("client_id", a.client_id).is("project_id", null).is("quotation_id", null);
  const { data } = await query;
  return (data ?? [])
    .filter((r) => r.receipt_date < a.receipt_date || r.created_at <= a.created_at)
    .reduce((acc, r) => acc + Number(r.amount) - Number(r.refunded_amount), 0);
}

export type AdvanceTargetOption = {
  /** «project:<id>», «quotation:<id>» o «client». */
  value: string;
  clientId: string;
  kind: "project" | "quotation" | "client";
  label: string;
  detail: string;
  /** Moneda fija (la de la cotización); null = se elige. */
  currency: string | null;
  totalQuoted: number | null;
  /** Ya pagado: anticipos (menos devoluciones) + cobros de sus facturas, en la moneda del destino. */
  received: number;
  /** % de anticipo pactado en la cotización (ej. 50). */
  advancePercent: number | null;
};

/**
 * Para el formulario «Registrar anticipo»: a qué se le puede ligar un
 * anticipo de cada cliente (proyectos no cancelados y cotizaciones
 * aprobadas que todavía no están en un proyecto).
 */
export async function listAdvanceTargets(clientId?: string): Promise<AdvanceTargetOption[]> {
  const supabase = await createClient();
  let pq = supabase.from("projects").select("id, number, name, client_id, status").neq("status", "CANCELLED").order("number", { ascending: false });
  let qq = supabase
    .from("quotations")
    .select("id, number, client_id, total, currency, advance_percent, project_id")
    .eq("status", "APPROVED")
    .order("number", { ascending: false });
  let aq = supabase.from("customer_advances").select("project_id, quotation_id, amount, refunded_amount, currency");
  // Lo ya cobrado de facturas (dinero + retenciones) también rebaja lo que resta de lo cotizado.
  let cq = supabase
    .from("customer_payments")
    .select("amount_applied, amount, currency, invoices!inner(project_id, quotation_id, status)")
    .neq("invoices.status", "CANCELLED");
  if (clientId) {
    pq = pq.eq("client_id", clientId);
    qq = qq.eq("client_id", clientId);
    aq = aq.eq("client_id", clientId);
    cq = cq.eq("client_id", clientId);
  }
  const [projects, quotations, advances, cobros] = await Promise.all([pq, qq, aq, cq]);
  if (projects.error) throw new Error(projects.error.message);
  if (quotations.error) throw new Error(quotations.error.message);
  if (advances.error) throw new Error(advances.error.message);
  if (cobros.error) throw new Error(cobros.error.message);

  const receivedFor = (key: "project_id" | "quotation_id", id: string, currency: string | null) =>
    (advances.data ?? [])
      .filter((a) => a[key] === id && (!currency || a.currency === currency))
      .reduce((acc, a) => acc + Number(a.amount) - Number(a.refunded_amount), 0) +
    (cobros.data ?? [])
      .filter((c) => relationRow<Record<string, string | null>>(c.invoices)?.[key] === id && (!currency || c.currency === currency))
      .reduce((acc, c) => acc + Number(c.amount_applied ?? c.amount), 0);

  const out: AdvanceTargetOption[] = [];
  for (const p of projects.data ?? []) {
    const qs = (quotations.data ?? []).filter((q) => q.project_id === p.id);
    const currencies = Array.from(new Set(qs.map((q) => q.currency)));
    const currency = currencies.length === 1 ? currencies[0] : null;
    const total = currency ? qs.reduce((acc, q) => acc + Number(q.total), 0) : null;
    const pct = qs.find((q) => Number(q.advance_percent) > 0)?.advance_percent ?? null;
    out.push({
      value: `project:${p.id}`,
      clientId: p.client_id,
      kind: "project",
      label: `${p.number} — ${p.name}`,
      detail: qs.length ? `Proyecto · cotizado ${qs.map((q) => q.number).join(", ")}` : "Proyecto sin cotización aprobada",
      currency,
      totalQuoted: total,
      received: receivedFor("project_id", p.id, currency),
      advancePercent: pct !== null ? Number(pct) : null,
    });
  }
  for (const q of (quotations.data ?? []).filter((q) => !q.project_id)) {
    out.push({
      value: `quotation:${q.id}`,
      clientId: q.client_id,
      kind: "quotation",
      label: q.number,
      detail: "Cotización aprobada, todavía sin proyecto",
      currency: q.currency,
      totalQuoted: Number(q.total),
      received: receivedFor("quotation_id", q.id, q.currency),
      advancePercent: Number(q.advance_percent) > 0 ? Number(q.advance_percent) : null,
    });
  }
  return out;
}

/** Facturas abiertas donde se puede aplicar este anticipo (para guiar al usuario). */
export async function listInvoicesForAdvance(a: Pick<AdvanceRow, "client_id" | "project_id" | "quotation_id" | "currency">) {
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select("id, number, balance, currency, status, project_id, quotation_id")
    .eq("client_id", a.client_id)
    .eq("currency", a.currency)
    .in("status", ["ISSUED", "PARTIALLY_PAID", "OVERDUE"])
    .gt("balance", 0)
    .order("issue_date", { ascending: false })
    .limit(20);
  if (a.project_id && a.quotation_id) query = query.or(`project_id.eq.${a.project_id},quotation_id.eq.${a.quotation_id}`);
  else if (a.project_id) query = query.eq("project_id", a.project_id);
  else if (a.quotation_id) query = query.eq("quotation_id", a.quotation_id);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Proyectos y cotizaciones del mismo cliente a donde se puede pasar el anticipo. */
export async function listTransferOptions(a: Pick<AdvanceRow, "client_id" | "project_id" | "quotation_id" | "currency">) {
  const targets = await listAdvanceTargets(a.client_id);
  const current = a.project_id ? `project:${a.project_id}` : a.quotation_id ? `quotation:${a.quotation_id}` : "client";
  const opts = targets
    .filter((t) => t.value !== current && (!t.currency || t.currency === a.currency))
    .map((t) => ({ value: t.value, label: `${t.kind === "project" ? "Proyecto" : "Cotización"} ${t.label}` }));
  if (current !== "client") opts.push({ value: "client", label: "Sin cotización ni proyecto (solo el cliente)" });
  return opts;
}
