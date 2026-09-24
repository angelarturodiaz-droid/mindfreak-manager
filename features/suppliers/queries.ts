import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, pageRange } from "@/lib/utils/pagination";

export type SupplierListFilters = {
  search?: string;
  /** "active" | "inactive"; sin valor = todos */
  status?: "active" | "inactive";
  page?: number;
};

/** Lista paginada de proveedores (PAGE_SIZE por página), ordenada por nombre. */
export async function listSuppliers(filters: SupplierListFilters = {}) {
  const supabase = await createClient();
  const [from, to] = pageRange(filters.page ?? 1);
  let query = supabase
    .from("suppliers")
    .select("id, name, tax_id, category, service_type, email, phone, bank_name, is_active, created_at", {
      count: "exact",
    })
    .order("name", { ascending: true })
    .range(from, to);

  if (filters.search) query = query.ilike("name", `%${filters.search}%`);
  if (filters.status === "active") query = query.eq("is_active", true);
  if (filters.status === "inactive") query = query.eq("is_active", false);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: data, total: count ?? 0, pageSize: PAGE_SIZE };
}

const OPEN_EXPENSE_STATUSES = ["PENDING", "PARTIALLY_PAID"];

/** Resumen para el encabezado de /suppliers (solo lectura), en moneda base. */
export async function getSupplierStats() {
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(
    new Date(),
  );
  const monthStart = `${today.slice(0, 7)}-01`;
  const [suppliers, expenses, payments] = await Promise.all([
    supabase.from("suppliers").select("is_active"),
    supabase
      .from("expenses")
      .select("balance, exchange_rate")
      .not("supplier_id", "is", null)
      .in("status", OPEN_EXPENSE_STATUSES),
    supabase
      .from("supplier_payments")
      .select("amount, exchange_rate")
      .gte("payment_date", monthStart),
  ]);
  for (const r of [suppliers, expenses, payments]) if (r.error) throw new Error(r.error.message);

  const active = (suppliers.data ?? []).filter((s) => s.is_active).length;
  const porPagar = (expenses.data ?? []).reduce(
    (acc, e) => acc + Number(e.balance) * Number(e.exchange_rate ?? 1),
    0,
  );
  const pagadoMes = (payments.data ?? []).reduce(
    (acc, p) => acc + Number(p.amount) * Number(p.exchange_rate ?? 1),
    0,
  );
  return {
    total: (suppliers.data ?? []).length,
    active,
    inactive: (suppliers.data ?? []).length - active,
    porPagar,
    porPagarCount: (expenses.data ?? []).length,
    pagadoMes,
  };
}

/** Por proveedor de la página: total gastado (sin cancelados) y por pagar. */
export async function getSupplierListAggregates(supplierIds: string[]) {
  const result: Record<string, { gastado: number; porPagar: number }> = {};
  if (supplierIds.length === 0) return result;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("supplier_id, status, total, balance, exchange_rate")
    .in("supplier_id", supplierIds)
    .neq("status", "CANCELLED");
  if (error) throw new Error(error.message);
  for (const id of supplierIds) result[id] = { gastado: 0, porPagar: 0 };
  for (const e of data ?? []) {
    if (!e.supplier_id) continue;
    const rate = Number(e.exchange_rate ?? 1);
    result[e.supplier_id].gastado += Number(e.total) * rate;
    if (OPEN_EXPENSE_STATUSES.includes(e.status)) result[e.supplier_id].porPagar += Number(e.balance) * rate;
  }
  return result;
}

/** Historial de un proveedor para su detalle: gastos, pagos y totales (moneda base). */
export async function getSupplierActivity(supplierId: string) {
  const supabase = await createClient();
  const [expenses, payments] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, expense_date, description, total, balance, status, currency, exchange_rate, project_id, projects(number, name)")
      .eq("supplier_id", supplierId)
      .order("expense_date", { ascending: false }),
    supabase
      .from("supplier_payments")
      .select("id, expense_id, payment_date, amount, method, currency, exchange_rate, bank_accounts(name, bank_name), expenses(description)")
      .eq("supplier_id", supplierId)
      .order("payment_date", { ascending: false }),
  ]);
  if (expenses.error) throw new Error(expenses.error.message);
  if (payments.error) throw new Error(payments.error.message);

  const exp = expenses.data ?? [];
  const pay = payments.data ?? [];
  const base = (v: number, r: number | null) => Number(v) * Number(r ?? 1);
  const valid = exp.filter((e) => e.status !== "CANCELLED");
  return {
    expenses: exp,
    payments: pay,
    totals: {
      gastado: valid.reduce((a, e) => a + base(e.total, e.exchange_rate), 0),
      pagado: pay.reduce((a, p) => a + base(p.amount, p.exchange_rate), 0),
      porPagar: valid
        .filter((e) => OPEN_EXPENSE_STATUSES.includes(e.status))
        .reduce((a, e) => a + base(e.balance, e.exchange_rate), 0),
      proyectos: new Set(valid.map((e) => e.project_id).filter(Boolean)).size,
    },
  };
}

export async function getSupplier(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listSupplierContacts(supplierId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_contacts")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("is_primary", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listImportBatches() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_batches")
    .select("*")
    .eq("entity_type", "suppliers")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data;
}
