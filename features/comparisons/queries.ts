import { createClient } from "@/lib/supabase/server";
import { pctDelta, type Period } from "./period";

type NameRel = { name: string } | { name: string }[] | null;
function relName(rel: NameRel): string | null {
  return Array.isArray(rel) ? rel[0]?.name ?? null : rel?.name ?? null;
}

const ACTIVE_INVOICE_STATUSES_EXCLUDE = "CANCELLED";
const ACTIVE_EXPENSE_STATUSES_EXCLUDE = "CANCELLED";

// ---------------------------------------------------------------------------
// 1. Rentabilidad por proyecto
// ---------------------------------------------------------------------------

export type ProjectProfitabilityRow = {
  id: string;
  number: string;
  name: string;
  status: string;
  ingresos: number;
  gastos: number;
  utilidad: number;
  margen: number | null;
};

/**
 * Rentabilidad por proyecto — proyectos cuyo evento cae en el período
 * (`event_date`), con los ingresos (facturado, sin canceladas) y gastos
 * (sin cancelados) que ese proyecto acumuló. Es la misma definición que
 * usa Reportes → "Rentabilidad por proyecto", reutilizada aquí junto al
 * total del período anterior para poder mostrar la diferencia.
 */
export async function getProjectProfitabilityComparison(period: Period) {
  async function forRange(from: string, to: string): Promise<ProjectProfitabilityRow[]> {
    const supabase = await createClient();
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, number, name, status")
      .gte("event_date", from)
      .lte("event_date", to)
      .order("event_date", { ascending: false });
    if (projectsError) throw new Error(projectsError.message);
    if (!projects || projects.length === 0) return [];

    const projectIds = projects.map((p) => p.id);
    const [invoices, expenses] = await Promise.all([
      supabase
        .from("invoices")
        .select("project_id, total, exchange_rate")
        .in("project_id", projectIds)
        .neq("status", ACTIVE_INVOICE_STATUSES_EXCLUDE),
      supabase
        .from("expenses")
        .select("project_id, total, exchange_rate")
        .in("project_id", projectIds)
        .neq("status", ACTIVE_EXPENSE_STATUSES_EXCLUDE),
    ]);
    if (invoices.error) throw new Error(invoices.error.message);
    if (expenses.error) throw new Error(expenses.error.message);

    function sumByProject(rows: { project_id: string | null; total: number; exchange_rate: number }[] | null) {
      const map = new Map<string, number>();
      for (const r of rows ?? []) {
        if (!r.project_id) continue;
        map.set(r.project_id, (map.get(r.project_id) ?? 0) + r.total * r.exchange_rate);
      }
      return map;
    }

    const ingresosMap = sumByProject(invoices.data);
    const gastosMap = sumByProject(expenses.data);

    return projects.map((p) => {
      const ingresos = ingresosMap.get(p.id) ?? 0;
      const gastos = gastosMap.get(p.id) ?? 0;
      const utilidad = ingresos - gastos;
      return { ...p, ingresos, gastos, utilidad, margen: ingresos > 0 ? (utilidad / ingresos) * 100 : null };
    });
  }

  const [current, previous] = await Promise.all([
    forRange(period.from, period.to),
    forRange(period.prevFrom, period.prevTo),
  ]);

  const prevById = new Map(previous.map((p) => [p.id, p]));
  const rows = current
    .map((p) => {
      const prev = prevById.get(p.id);
      return { ...p, utilidadPrev: prev?.utilidad ?? 0, deltaUtilidadPct: prev ? pctDelta(p.utilidad, prev.utilidad) : null };
    })
    .sort((a, b) => b.utilidad - a.utilidad);

  const totals = {
    ingresos: current.reduce((a, p) => a + p.ingresos, 0),
    gastos: current.reduce((a, p) => a + p.gastos, 0),
    utilidad: current.reduce((a, p) => a + p.utilidad, 0),
  };
  const prevTotals = {
    ingresos: previous.reduce((a, p) => a + p.ingresos, 0),
    gastos: previous.reduce((a, p) => a + p.gastos, 0),
    utilidad: previous.reduce((a, p) => a + p.utilidad, 0),
  };

  return {
    rows,
    totals: {
      ...totals,
      margen: totals.ingresos > 0 ? (totals.utilidad / totals.ingresos) * 100 : null,
      deltaIngresosPct: pctDelta(totals.ingresos, prevTotals.ingresos),
      deltaGastosPct: pctDelta(totals.gastos, prevTotals.gastos),
      deltaUtilidadPct: pctDelta(totals.utilidad, prevTotals.utilidad),
      prevIngresos: prevTotals.ingresos,
      prevGastos: prevTotals.gastos,
      prevUtilidad: prevTotals.utilidad,
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Cuentas por cobrar vs. cuentas por pagar
// ---------------------------------------------------------------------------

const PENDING_INVOICE_STATUSES = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"];
const PENDING_EXPENSE_STATUSES = ["PENDING", "PARTIALLY_PAID"];

/**
 * CxC vs. CxP de lo emitido/registrado en el período (`issue_date` /
 * `expense_date`), en su saldo ACTUAL (en vivo). CxC trae vencidas y
 * próximas a vencer porque las facturas sí tienen `due_date`; los gastos
 * no tienen fecha de vencimiento en este sistema (no hay términos de
 * pago a proveedores todavía), así que CxP solo muestra el pendiente
 * total — se documenta explícitamente en vez de inventar un vencimiento.
 */
export async function getReceivablesVsPayables(period: Period) {
  const supabase = await createClient();

  const [{ data: invoices, error: invError }, { data: expenses, error: expError }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, number, due_date, balance, currency, exchange_rate, status, clients(name)")
      .in("status", PENDING_INVOICE_STATUSES)
      .gt("balance", 0)
      .gte("issue_date", period.from)
      .lte("issue_date", period.to)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("expenses")
      .select("id, description, expense_date, balance, currency, exchange_rate, status, suppliers(name)")
      .in("status", PENDING_EXPENSE_STATUSES)
      .gt("balance", 0)
      .gte("expense_date", period.from)
      .lte("expense_date", period.to)
      .order("expense_date", { ascending: true }),
  ]);
  if (invError) throw new Error(invError.message);
  if (expError) throw new Error(expError.message);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const invoicesWithDays = (invoices ?? []).map((inv) => {
    const daysUntilDue = inv.due_date
      ? Math.round((new Date(`${inv.due_date}T00:00:00Z`).getTime() - today.getTime()) / 86400000)
      : null;
    return { ...inv, clientName: relName(inv.clients), daysUntilDue };
  });

  const convertedSum = (rows: { balance: number; exchange_rate: number }[]) =>
    rows.reduce((acc, r) => acc + r.balance * r.exchange_rate, 0);

  const vencidas = invoicesWithDays.filter((i) => i.daysUntilDue !== null && i.daysUntilDue < 0);
  const proximas7 = invoicesWithDays.filter((i) => i.daysUntilDue !== null && i.daysUntilDue >= 0 && i.daysUntilDue <= 7);
  const proximas15 = invoicesWithDays.filter((i) => i.daysUntilDue !== null && i.daysUntilDue >= 0 && i.daysUntilDue <= 15);
  const proximas30 = invoicesWithDays.filter((i) => i.daysUntilDue !== null && i.daysUntilDue >= 0 && i.daysUntilDue <= 30);

  const expensesWithSupplier = (expenses ?? []).map((e) => ({ ...e, supplierName: relName(e.suppliers) }));

  return {
    cxc: {
      pendiente: convertedSum(invoicesWithDays),
      vencido: convertedSum(vencidas),
      proximos7: convertedSum(proximas7),
      proximos15: convertedSum(proximas15),
      proximos30: convertedSum(proximas30),
      facturasVencidas: vencidas.slice(0, 8),
      count: invoicesWithDays.length,
    },
    cxp: {
      pendiente: convertedSum(expensesWithSupplier),
      count: expensesWithSupplier.length,
      gastosPendientes: expensesWithSupplier.slice(0, 8),
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Ventas por cliente
// ---------------------------------------------------------------------------

export type SalesByClientRow = {
  clientId: string;
  name: string;
  ventas: number;
  cobros: number;
  saldoPendiente: number;
  deltaVentasPct: number | null;
};

export async function getSalesByClientComparison(period: Period) {
  const supabase = await createClient();

  async function salesFor(from: string, to: string) {
    const { data, error } = await supabase
      .from("invoices")
      .select("client_id, total, balance, exchange_rate, clients(name)")
      .neq("status", ACTIVE_INVOICE_STATUSES_EXCLUDE)
      .gte("issue_date", from)
      .lte("issue_date", to);
    if (error) throw new Error(error.message);
    const map = new Map<string, { name: string; ventas: number; saldoPendiente: number }>();
    for (const row of data ?? []) {
      if (!row.client_id) continue;
      const name = relName(row.clients) ?? "—";
      const current = map.get(row.client_id) ?? { name, ventas: 0, saldoPendiente: 0 };
      current.ventas += row.total * row.exchange_rate;
      current.saldoPendiente += row.balance * row.exchange_rate;
      map.set(row.client_id, current);
    }
    return map;
  }

  async function collectionsFor(from: string, to: string) {
    const { data, error } = await supabase
      .from("customer_payments")
      .select("client_id, amount, exchange_rate")
      .gte("payment_date", from)
      .lte("payment_date", to);
    if (error) throw new Error(error.message);
    const map = new Map<string, number>();
    for (const row of data ?? []) {
      if (!row.client_id) continue;
      map.set(row.client_id, (map.get(row.client_id) ?? 0) + row.amount * row.exchange_rate);
    }
    return map;
  }

  const [salesCurrent, salesPrev, collections] = await Promise.all([
    salesFor(period.from, period.to),
    salesFor(period.prevFrom, period.prevTo),
    collectionsFor(period.from, period.to),
  ]);

  const clientIds = new Set([...salesCurrent.keys(), ...collections.keys()]);
  const rows: SalesByClientRow[] = Array.from(clientIds).map((clientId) => {
    const sales = salesCurrent.get(clientId);
    const prevSales = salesPrev.get(clientId);
    return {
      clientId,
      name: sales?.name ?? "—",
      ventas: sales?.ventas ?? 0,
      cobros: collections.get(clientId) ?? 0,
      saldoPendiente: sales?.saldoPendiente ?? 0,
      deltaVentasPct: prevSales ? pctDelta(sales?.ventas ?? 0, prevSales.ventas) : null,
    };
  });

  // Nombres para clientes que solo tienen cobros en el período (sin
  // ventas registradas en él) — se resuelven aparte porque no vienen del
  // join de invoices.
  const missingNames = rows.filter((r) => r.name === "—" && collections.has(r.clientId));
  if (missingNames.length > 0) {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name")
      .in(
        "id",
        missingNames.map((r) => r.clientId),
      );
    const nameMap = new Map((clients ?? []).map((c) => [c.id, c.name]));
    for (const r of rows) {
      if (r.name === "—" && nameMap.has(r.clientId)) r.name = nameMap.get(r.clientId) as string;
    }
  }

  rows.sort((a, b) => b.ventas - a.ventas);

  const totals = {
    ventas: rows.reduce((a, r) => a + r.ventas, 0),
    cobros: rows.reduce((a, r) => a + r.cobros, 0),
    saldoPendiente: rows.reduce((a, r) => a + r.saldoPendiente, 0),
  };

  return { rows, totals };
}

// ---------------------------------------------------------------------------
// 4. Rentabilidad por cliente
// ---------------------------------------------------------------------------

export type ClientProfitabilityRow = {
  clientId: string;
  name: string;
  ingresos: number;
  costos: number;
  utilidad: number;
  margen: number | null;
};

/**
 * Rentabilidad por cliente — ingresos = facturado del cliente en el
 * período; costos = gastos de los proyectos DE ese cliente en el
 * período (los gastos no tienen client_id directo, se atribuyen vía su
 * proyecto). Los gastos sin proyecto no se pueden atribuir a un cliente
 * y quedan fuera, a propósito.
 */
export async function getClientProfitabilityComparison(period: Period) {
  async function forRange(from: string, to: string): Promise<Map<string, { name: string; ingresos: number; costos: number }>> {
    const supabase = await createClient();

    const [invoicesRes, projectsRes] = await Promise.all([
      supabase
        .from("invoices")
        .select("client_id, total, exchange_rate, clients(name)")
        .neq("status", ACTIVE_INVOICE_STATUSES_EXCLUDE)
        .gte("issue_date", from)
        .lte("issue_date", to),
      supabase.from("projects").select("id, client_id"),
    ]);
    if (invoicesRes.error) throw new Error(invoicesRes.error.message);
    if (projectsRes.error) throw new Error(projectsRes.error.message);

    const projectToClient = new Map((projectsRes.data ?? []).map((p) => [p.id, p.client_id]));
    const projectIds = (projectsRes.data ?? []).map((p) => p.id);

    const map = new Map<string, { name: string; ingresos: number; costos: number }>();
    for (const row of invoicesRes.data ?? []) {
      if (!row.client_id) continue;
      const name = relName(row.clients) ?? "—";
      const current = map.get(row.client_id) ?? { name, ingresos: 0, costos: 0 };
      current.ingresos += row.total * row.exchange_rate;
      map.set(row.client_id, current);
    }

    if (projectIds.length > 0) {
      const { data: expenses, error: expError } = await supabase
        .from("expenses")
        .select("project_id, total, exchange_rate")
        .neq("status", ACTIVE_EXPENSE_STATUSES_EXCLUDE)
        .gte("expense_date", from)
        .lte("expense_date", to)
        .in("project_id", projectIds);
      if (expError) throw new Error(expError.message);
      for (const row of expenses ?? []) {
        if (!row.project_id) continue;
        const clientId = projectToClient.get(row.project_id);
        if (!clientId) continue;
        const current = map.get(clientId) ?? { name: "—", ingresos: 0, costos: 0 };
        current.costos += row.total * row.exchange_rate;
        map.set(clientId, current);
      }
    }

    return map;
  }

  const [current, previous] = await Promise.all([
    forRange(period.from, period.to),
    forRange(period.prevFrom, period.prevTo),
  ]);

  const supabase = await createClient();
  const needsName = Array.from(current.entries()).filter(([, v]) => v.name === "—");
  if (needsName.length > 0) {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name")
      .in(
        "id",
        needsName.map(([id]) => id),
      );
    const nameMap = new Map((clients ?? []).map((c) => [c.id, c.name]));
    for (const [id, v] of current) {
      if (v.name === "—" && nameMap.has(id)) v.name = nameMap.get(id) as string;
    }
  }

  const rows: (ClientProfitabilityRow & { deltaUtilidadPct: number | null })[] = Array.from(current.entries())
    .map(([clientId, v]) => {
      const utilidad = v.ingresos - v.costos;
      const prev = previous.get(clientId);
      const prevUtilidad = prev ? prev.ingresos - prev.costos : 0;
      return {
        clientId,
        name: v.name,
        ingresos: v.ingresos,
        costos: v.costos,
        utilidad,
        margen: v.ingresos > 0 ? (utilidad / v.ingresos) * 100 : null,
        deltaUtilidadPct: prev ? pctDelta(utilidad, prevUtilidad) : null,
      };
    })
    .sort((a, b) => b.utilidad - a.utilidad);

  const totals = {
    ingresos: rows.reduce((a, r) => a + r.ingresos, 0),
    costos: rows.reduce((a, r) => a + r.costos, 0),
    utilidad: rows.reduce((a, r) => a + r.utilidad, 0),
  };

  return { rows, totals: { ...totals, margen: totals.ingresos > 0 ? (totals.utilidad / totals.ingresos) * 100 : null } };
}

// ---------------------------------------------------------------------------
// 5. Período actual vs. período anterior
// ---------------------------------------------------------------------------

export type PeriodTotals = {
  ventas: number;
  gastos: number;
  utilidad: number;
  margen: number | null;
};

export async function getPeriodOverPeriodComparison(period: Period) {
  async function totalsFor(from: string, to: string): Promise<PeriodTotals> {
    const supabase = await createClient();
    const [invoicesRes, expensesRes] = await Promise.all([
      supabase
        .from("invoices")
        .select("total, exchange_rate")
        .neq("status", ACTIVE_INVOICE_STATUSES_EXCLUDE)
        .gte("issue_date", from)
        .lte("issue_date", to),
      supabase
        .from("expenses")
        .select("total, exchange_rate")
        .neq("status", ACTIVE_EXPENSE_STATUSES_EXCLUDE)
        .gte("expense_date", from)
        .lte("expense_date", to),
    ]);
    if (invoicesRes.error) throw new Error(invoicesRes.error.message);
    if (expensesRes.error) throw new Error(expensesRes.error.message);

    const ventas = (invoicesRes.data ?? []).reduce((a, r) => a + r.total * r.exchange_rate, 0);
    const gastos = (expensesRes.data ?? []).reduce((a, r) => a + r.total * r.exchange_rate, 0);
    const utilidad = ventas - gastos;
    return { ventas, gastos, utilidad, margen: ventas > 0 ? (utilidad / ventas) * 100 : null };
  }

  const [current, previous] = await Promise.all([
    totalsFor(period.from, period.to),
    totalsFor(period.prevFrom, period.prevTo),
  ]);

  return {
    current,
    previous,
    deltaVentas: { abs: current.ventas - previous.ventas, pct: pctDelta(current.ventas, previous.ventas) },
    deltaGastos: { abs: current.gastos - previous.gastos, pct: pctDelta(current.gastos, previous.gastos) },
    deltaUtilidad: { abs: current.utilidad - previous.utilidad, pct: pctDelta(current.utilidad, previous.utilidad) },
    deltaMargen:
      current.margen !== null && previous.margen !== null ? current.margen - previous.margen : null,
  };
}
