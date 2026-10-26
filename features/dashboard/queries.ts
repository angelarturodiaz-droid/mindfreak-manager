import { createClient } from "@/lib/supabase/server";
import { profit, sumExpenses, sumSales } from "@/features/profitability/net-of-tax";

/**
 * Mes calendario en hora de República Dominicana. El servidor corre en UTC:
 * sin esto, desde las 8:00 p. m. del último día del mes el Dashboard ya
 * mostraba el mes siguiente.
 */
function monthRange(monthsAgo: number) {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo", year: "numeric", month: "2-digit" })
    .format(new Date())
    .split("-")
    .map(Number);
  const iso = (year: number, month0: number) => {
    const d = new Date(Date.UTC(year, month0, 1));
    return d.toISOString().slice(0, 10);
  };
  const start = iso(y, m - 1 - monthsAgo);
  const end = iso(y, m - monthsAgo);
  return {
    start,
    end,
    label: new Date(`${start}T12:00:00Z`).toLocaleDateString("es-DO", { month: "short", year: "2-digit", timeZone: "UTC" }),
  };
}

const sumConverted = (
  rows: { total?: number; amount?: number; balance?: number; exchange_rate: number }[] | null,
  field: "total" | "amount" | "balance" = "total",
) => (rows ?? []).reduce((acc, r) => acc + (r[field] ?? 0) * r.exchange_rate, 0);

/**
 * KPIs del mes en curso + saldos vivos (cuentas por cobrar/pagar) + conteos.
 * Todo consolidado en la moneda base de la empresa, igual que Rentabilidad
 * (F15) — usando el exchange_rate ya congelado de cada registro.
 */
export async function getDashboardKPIs() {
  const supabase = await createClient();
  const { start, end } = monthRange(0);

  const [
    invoicesThisMonth,
    paymentsThisMonth,
    expensesThisMonth,
    supplierPaymentsThisMonth,
    receivables,
    payables,
    activeProjects,
    pendingQuotations,
    approvedQuotations,
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("total, tax, exchange_rate")
      // Borradores y canceladas no son ventas.
      .not("status", "in", "(CANCELLED,DRAFT)")
      .gte("issue_date", start)
      .lt("issue_date", end),
    supabase
      .from("customer_payments")
      .select("amount, exchange_rate")
      .gte("payment_date", start)
      .lt("payment_date", end),
    supabase
      .from("expenses")
      .select("subtotal, total, exchange_rate")
      .neq("status", "CANCELLED")
      .gte("expense_date", start)
      .lt("expense_date", end),
    supabase
      .from("supplier_payments")
      .select("amount, exchange_rate")
      .gte("payment_date", start)
      .lt("payment_date", end),
    supabase
      .from("invoices")
      .select("balance, exchange_rate")
      .in("status", ["ISSUED", "PARTIALLY_PAID", "OVERDUE"]),
    supabase
      .from("expenses")
      .select("balance, exchange_rate")
      .in("status", ["PENDING", "PARTIALLY_PAID"]),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .in("status", ["PLANNING", "CONFIRMED", "IN_PROGRESS"]),
    supabase
      .from("quotations")
      .select("id", { count: "exact", head: true })
      .in("status", ["DRAFT", "SENT", "VIEWED", "NEGOTIATING"]),
    supabase
      .from("quotations")
      .select("id", { count: "exact", head: true })
      .eq("status", "APPROVED"),
  ]);

  for (const r of [
    invoicesThisMonth,
    paymentsThisMonth,
    expensesThisMonth,
    supplierPaymentsThisMonth,
    receivables,
    payables,
    activeProjects,
    pendingQuotations,
    approvedQuotations,
  ]) {
    if (r.error) throw new Error(r.error.message);
  }

  // V1-1: ventas y gastos SIN ITBIS para la utilidad y el margen; con ITBIS
  // como referencia (y para comparar con lo cobrado, que es dinero).
  const ventasT = sumSales(invoicesThisMonth.data);
  const gastosT = sumExpenses(expensesThisMonth.data);
  const ventas = ventasT.net;
  const cobros = sumConverted(paymentsThisMonth.data, "amount");
  const gastos = gastosT.net;
  const pagos = sumConverted(supplierPaymentsThisMonth.data, "amount");
  const cuentasPorCobrar = sumConverted(receivables.data, "balance");
  const cuentasPorPagar = sumConverted(payables.data, "balance");
  const { utilidad, margen } = profit(ventas, gastos);

  return {
    /** Sin ITBIS. */
    ventas,
    ventasConItbis: ventasT.gross,
    cobros,
    /** Sin ITBIS. */
    gastos,
    gastosConItbis: gastosT.gross,
    pagos,
    cuentasPorCobrar,
    cuentasPorPagar,
    utilidad,
    margen,
    proyectosActivos: activeProjects.count ?? 0,
    cotizacionesPendientes: pendingQuotations.count ?? 0,
    cotizacionesAprobadas: approvedQuotations.count ?? 0,
  };
}

/**
 * Flujo financiero: Cobros vs Pagos de los últimos N meses (para el gráfico).
 */
export async function getFinancialFlowSeries(months = 6) {
  const supabase = await createClient();
  const ranges = Array.from({ length: months }, (_, i) => monthRange(months - 1 - i));

  const series = await Promise.all(
    ranges.map(async (r) => {
      const [payments, supplierPayments] = await Promise.all([
        supabase
          .from("customer_payments")
          .select("amount, exchange_rate")
          .gte("payment_date", r.start)
          .lt("payment_date", r.end),
        supabase
          .from("supplier_payments")
          .select("amount, exchange_rate")
          .gte("payment_date", r.start)
          .lt("payment_date", r.end),
      ]);
      if (payments.error) throw new Error(payments.error.message);
      if (supplierPayments.error) throw new Error(supplierPayments.error.message);

      return {
        month: r.label,
        cobros: sumConverted(payments.data, "amount"),
        pagos: sumConverted(supplierPayments.data, "amount"),
      };
    }),
  );

  return series;
}
