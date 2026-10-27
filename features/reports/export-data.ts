import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import { relationName } from "@/lib/utils/relation";
import {
  CASHFLOW_ORIGINS,
  getAccountsPayableReport,
  getAccountsReceivableReport,
  getCashflowByCategoryReport,
  getCustomerWithholdingsReport,
  getExpensesByCategoryReport,
  getPaymentsByCurrencyReport,
  getProjectsProfitabilityReport,
  getReceivablesDashboard,
  getSalesByClientReport,
  getIncomeByTaxTypeReport,
  type CashflowOrigin,
} from "./queries";
import {
  fmtDateISO,
  type ExportCell,
  type ExportSection,
  type ExportSummaryItem,
  type ReportExportData,
} from "./export-types";

/** Filtros de la URL de Reportes (los mismos que usa la pantalla). */
export type ReportExportParams = Partial<
  Record<
    | "from"
    | "to"
    | "project_id"
    | "client_id"
    | "supplier_id"
    | "category_id"
    | "manager_id"
    | "status"
    | "currency"
    | "bank_account_id"
    | "include_transfers"
    | "view"
    | "origin"
    | "direction"
    | "only_foreign"
    | "wh_type"
    | "wh_status"
    | "missing_cert",
    string
  >
>;

export const EXPORTABLE_REPORTS: Record<string, { title: string; description: string }> = {
  rentabilidad: {
    title: "Rentabilidad por proyecto",
    description: "Cotizado, facturado, cobrado y costo real de cada proyecto, con su utilidad y margen (moneda base). Utilidad sin ITBIS.",
  },
  vencimientos: {
    title: "Cuentas por cobrar y vencimientos",
    description: "Consolidado en la moneda base, en vivo (no es un corte histórico).",
  },
  cxc: { title: "Cuentas por cobrar", description: "Facturas con balance pendiente." },
  cxp: { title: "Cuentas por pagar", description: "Gastos con saldo pendiente con proveedores." },
  "ventas-cliente": {
    title: "Ventas por cliente",
    description: "Total facturado por cliente en la moneda base, de mayor a menor.",
  },
  "ingresos-impuesto": {
    title: "Ingresos por tipo de impuesto",
    description: "Facturas emitidas por mes: gravado, exento, ITBIS facturado y total, en la moneda base (fecha de emisión).",
  },
  "gastos-categoria": {
    title: "Gastos por categoría",
    description: "Total gastado por categoría en la moneda base, de mayor a menor.",
  },
  "flujo-categoria": {
    title: "Ingresos y egresos por categoría",
    description: "Flujo real de los movimientos de banco, agrupado por categoría, en la moneda base.",
  },
  "por-moneda": {
    title: "Pagos y cobros por moneda",
    description:
      "Lo aplicado a cada factura o gasto en su moneda y lo que se movió en el banco en la moneda de la cuenta, con comisiones, tasas y diferencias.",
  },
  "retenciones-clientes": {
    title: "Retenciones de clientes",
    description:
      "Lo que los clientes retuvieron al pagar (ISR, ITBIS u otras). Rebaja el saldo de la factura pero no entra al banco: el cliente lo paga a la DGII y entrega un certificado.",
  },
};

const PROJECT_STATUS: Record<string, string> = {
  PLANNING: "Planificación",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};
const INVOICE_STATUS: Record<string, string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitida",
  PARTIALLY_PAID: "Parcial",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};
const EXPENSE_STATUS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIALLY_PAID: "Parcial",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
};
const WH_TYPE: Record<string, string> = { ITBIS: "ITBIS", ISR: "ISR", OTRO: "Otra" };

const money = (value: number, currency: string): ExportCell => ({ money: Math.round(value * 100) / 100, currency });

/** "Desde: 01/10/2026", "Cliente: Juan Pérez"… con los nombres reales. */
async function describeFilters(report: string, p: ReportExportParams): Promise<string[]> {
  const supabase = await createClient();
  const out: string[] = [];
  const nameOf = async (table: string, id: string, cols = "name") => {
    const { data } = await supabase.from(table).select(cols).eq("id", id).maybeSingle();
    const row = data as Record<string, string> | null;
    if (!row) return id;
    return table === "projects" ? `${row.number} — ${row.name}` : (row.name ?? row.full_name ?? id);
  };
  if (p.from) out.push(`Desde: ${fmtDateISO(p.from)}`);
  if (p.to) out.push(`Hasta: ${fmtDateISO(p.to)}`);
  if (p.client_id) out.push(`Cliente: ${await nameOf("clients", p.client_id)}`);
  if (p.supplier_id) out.push(`Proveedor: ${await nameOf("suppliers", p.supplier_id)}`);
  if (p.project_id)
    out.push(`Proyecto: ${p.project_id === "none" ? "Sin proyecto" : await nameOf("projects", p.project_id, "number, name")}`);
  if (p.category_id)
    out.push(`Categoría: ${p.category_id === "none" ? "Sin categoría" : await nameOf("expense_categories", p.category_id)}`);
  if (p.manager_id) out.push(`Responsable: ${await nameOf("profiles", p.manager_id, "full_name")}`);
  if (p.bank_account_id) out.push(`Cuenta: ${await nameOf("bank_accounts", p.bank_account_id)}`);
  if (p.status) {
    const labels = report === "rentabilidad" ? PROJECT_STATUS : report === "cxp" || report === "gastos-categoria" ? EXPENSE_STATUS : INVOICE_STATUS;
    out.push(`Estado: ${labels[p.status] ?? p.status}`);
  }
  if (p.currency) out.push(`Moneda: ${p.currency}`);
  if (p.direction) {
    const cash = report === "flujo-categoria";
    out.push(`Tipo: ${p.direction === "in" ? (cash ? "Solo ingresos" : "Solo cobros") : cash ? "Solo egresos" : "Solo pagos"}`);
  }
  if (p.origin && p.origin in CASHFLOW_ORIGINS) out.push(`Origen: ${CASHFLOW_ORIGINS[p.origin as CashflowOrigin]}`);
  if (p.include_transfers === "1") out.push("Incluye transferencias entre cuentas");
  if (p.only_foreign === "1") out.push("Solo en moneda diferente");
  if (p.wh_type) out.push(`Tipo: ${WH_TYPE[p.wh_type] ?? p.wh_type}`);
  if (p.wh_status) out.push(`Estado: ${p.wh_status === "VOIDED" ? "Anuladas" : p.wh_status === "all" ? "Todas" : "Activas"}`);
  if (p.missing_cert === "1") out.push("Solo sin certificado");
  return out;
}

type Built = Pick<ReportExportData, "summary" | "sections" | "notes">;

async function buildSections(report: string, p: ReportExportParams, base: string): Promise<Built> {
  const summary: ExportSummaryItem[] = [];
  const sections: ExportSection[] = [];
  const notes: string[] = [];

  switch (report) {
    case "rentabilidad": {
      const rows = await getProjectsProfitabilityReport({
        from: p.from,
        to: p.to,
        projectId: p.project_id,
        clientId: p.client_id,
        status: p.status,
        managerId: p.manager_id,
      });
      const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
      const fact = sum((r) => r.facturado);
      const util = sum((r) => r.utilidadReal);
      summary.push(
        { label: "Proyectos", value: rows.length },
        { label: "Facturado sin ITBIS", value: money(fact, base) },
        { label: "Cobrado (con ITBIS)", value: money(sum((r) => r.cobrado), base) },
        { label: "Costo real sin ITBIS", value: money(sum((r) => r.costoReal), base) },
        { label: "Incentivos", value: money(sum((r) => r.incentivos), base) },
        { label: "Utilidad real", value: money(util, base) },
      );
      sections.push({
        columns: [
          { header: "N.º", kind: "text" },
          { header: "Proyecto", kind: "text" },
          { header: "Estado", kind: "text" },
          { header: "Cotizado sin ITBIS", kind: "money", currency: base },
          { header: "Facturado sin ITBIS", kind: "money", currency: base },
          { header: "Cobrado (con ITBIS)", kind: "money", currency: base },
          { header: "Costo real sin ITBIS", kind: "money", currency: base },
          { header: "Incentivos", kind: "money", currency: base },
          { header: "Utilidad real", kind: "money", currency: base },
          { header: "Margen", kind: "percent" },
        ],
        rows: rows.map((r) => [
          r.number,
          r.name,
          PROJECT_STATUS[r.status] ?? r.status,
          r.cotizado,
          r.facturado,
          r.cobrado,
          r.costoReal,
          r.incentivos,
          r.utilidadReal,
          r.margenReal,
        ]),
        totals: [
          "Total",
          "",
          "",
          sum((r) => r.cotizado),
          fact,
          sum((r) => r.cobrado),
          sum((r) => r.costoReal),
          sum((r) => r.incentivos),
          util,
          fact > 0 ? (util / fact) * 100 : null,
        ],
      });
      notes.push("Utilidad real = facturado sin ITBIS − gastos sin ITBIS (subtotal) − incentivos por proyecto. Margen = utilidad ÷ facturado sin ITBIS. El ITBIS cobrado es de la DGII y el de las compras no es costo; el cobrado es dinero real, con ITBIS.");
      break;
    }

    case "vencimientos": {
      const d = await getReceivablesDashboard();
      summary.push(
        { label: "Total por cobrar", value: money(d.totalPorCobrar, base) },
        { label: "Total vencido", value: money(d.totalVencido, base) },
        { label: "Vence hoy", value: money(d.totalVenceHoy, base) },
        { label: "Próximos 7 días", value: money(d.totalProximos7, base) },
        { label: "Próximos 15 días", value: money(d.totalProximos15, base) },
        { label: "Próximos 30 días", value: money(d.totalProximos30, base) },
      );
      sections.push(
        {
          title: `Facturas vencidas (${d.facturasVencidas.length})`,
          columns: [
            { header: "Factura", kind: "text" },
            { header: "Cliente", kind: "text" },
            { header: "Vencimiento", kind: "date" },
            { header: "Días de atraso", kind: "number" },
            { header: "Balance", kind: "money" },
          ],
          rows: d.facturasVencidas.map((i) => [i.number, relationName(i.clients), i.due_date, i.daysOverdue, money(Number(i.balance), i.currency)]),
        },
        {
          title: `Facturas próximas a vencer — 30 días (${d.facturasProximasAVencer.length})`,
          columns: [
            { header: "Factura", kind: "text" },
            { header: "Cliente", kind: "text" },
            { header: "Vencimiento", kind: "date" },
            { header: "Vence en (días)", kind: "number" },
            { header: "Balance", kind: "money" },
          ],
          rows: d.facturasProximasAVencer.map((i) => [i.number, relationName(i.clients), i.due_date, i.daysUntilDue, money(Number(i.balance), i.currency)]),
        },
        {
          title: `Cotizaciones pendientes de aceptación (${d.cotizacionesPendientes.length})`,
          columns: [
            { header: "Cotización", kind: "text" },
            { header: "Cliente", kind: "text" },
            { header: "Válida hasta", kind: "date" },
            { header: "Total", kind: "money" },
          ],
          rows: d.cotizacionesPendientes.map((q) => [q.number, relationName(q.clients), q.valid_until, money(Number(q.total), q.currency)]),
        },
        {
          title: `Aceptadas, pendientes de facturar (${d.cotizacionesAceptadasSinFacturar.length})`,
          columns: [
            { header: "Cotización", kind: "text" },
            { header: "Cliente", kind: "text" },
            { header: "Total", kind: "money" },
          ],
          rows: d.cotizacionesAceptadasSinFacturar.map((q) => [q.number, relationName(q.clients), money(Number(q.total), q.currency)]),
        },
      );
      notes.push("Los totales de arriba están convertidos a la moneda base; cada fila va en la moneda del documento.");
      break;
    }

    case "cxc": {
      const rows = await getAccountsReceivableReport({
        from: p.from,
        to: p.to,
        clientId: p.client_id,
        status: p.status,
        projectId: p.project_id,
        currency: p.currency,
      });
      summary.push(...totalsByCurrency(rows.map((r) => ({ amount: Number(r.balance), currency: r.currency })), "Balance"));
      summary.push({ label: "Facturas", value: rows.length }, { label: "Vencidas", value: rows.filter((r) => r.daysOverdue > 0).length });
      sections.push({
        columns: [
          { header: "Factura", kind: "text" },
          { header: "Cliente", kind: "text" },
          { header: "Estado", kind: "text" },
          { header: "Vencimiento", kind: "date" },
          { header: "Situación", kind: "text" },
          { header: "Balance", kind: "money" },
        ],
        rows: rows.map((r) => [
          r.number,
          relationName(r.clients),
          INVOICE_STATUS[r.status] ?? r.status,
          r.due_date,
          r.daysOverdue > 0 ? `Vencida hace ${r.daysOverdue} ${r.daysOverdue === 1 ? "día" : "días"}` : "Al día",
          money(Number(r.balance), r.currency),
        ]),
      });
      break;
    }

    case "cxp": {
      const rows = await getAccountsPayableReport({
        from: p.from,
        to: p.to,
        supplierId: p.supplier_id,
        status: p.status,
        projectId: p.project_id,
        currency: p.currency,
      });
      summary.push(...totalsByCurrency(rows.map((r) => ({ amount: Number(r.balance), currency: r.currency })), "Por pagar"));
      summary.push({ label: "Gastos", value: rows.length });
      sections.push({
        columns: [
          { header: "Gasto", kind: "text" },
          { header: "Proveedor", kind: "text" },
          { header: "Fecha", kind: "date" },
          { header: "Estado", kind: "text" },
          { header: "Balance", kind: "money" },
        ],
        rows: rows.map((r) => [
          r.description,
          relationName(r.suppliers),
          r.expense_date,
          EXPENSE_STATUS[r.status] ?? r.status,
          money(Number(r.balance), r.currency),
        ]),
      });
      break;
    }

    case "ventas-cliente": {
      const rows = await getSalesByClientReport({
        from: p.from,
        to: p.to,
        clientId: p.client_id,
        projectId: p.project_id,
        status: p.status,
        currency: p.currency,
      });
      const total = rows.reduce((a, r) => a + r.total, 0);
      summary.push({ label: "Total facturado", value: money(total, base) }, { label: "Clientes", value: rows.length });
      sections.push({
        columns: [
          { header: "Cliente", kind: "text" },
          { header: "Participación", kind: "percent" },
          { header: "Total facturado", kind: "money", currency: base },
        ],
        rows: rows.map((r) => [r.name, total > 0 ? (r.total / total) * 100 : null, r.total]),
        totals: ["Total", total > 0 ? 100 : null, total],
      });
      break;
    }

    case "ingresos-impuesto": {
      const { months, invoices, totals } = await getIncomeByTaxTypeReport({
        from: p.from,
        to: p.to,
        clientId: p.client_id,
        projectId: p.project_id,
      });
      summary.push(
        { label: "Facturas emitidas", value: totals.facturas },
        { label: "Gravado", value: money(totals.gravado, base) },
        { label: "Exento", value: money(totals.exento, base) },
        { label: "Total sin ITBIS", value: money(totals.totalSinItbis, base) },
        { label: "ITBIS facturado", value: money(totals.itbis, base) },
        { label: "Total facturado", value: money(totals.total, base) },
        { label: "ITBIS retenido por clientes", value: money(totals.itbisRetenido, base) },
        { label: "ISR retenido por clientes", value: money(totals.isrRetenido, base) },
      );
      const otras = totals.otrasRetenciones > 0;
      const monthName = (ym: string) =>
        new Date(`${ym}-15T12:00:00Z`)
          .toLocaleDateString("es-DO", { month: "long", year: "numeric", timeZone: "UTC" })
          .replace(/^./, (c) => c.toUpperCase());
      sections.push({
        title: "Por mes",
        columns: [
          { header: "Mes", kind: "text" },
          { header: "Facturas", kind: "number" },
          { header: "Gravado", kind: "money", currency: base },
          { header: "Exento", kind: "money", currency: base },
          { header: "Total sin ITBIS", kind: "money", currency: base },
          { header: "ITBIS facturado", kind: "money", currency: base },
          { header: "Total facturado", kind: "money", currency: base },
          { header: "ITBIS retenido", kind: "money", currency: base },
          { header: "ISR retenido", kind: "money", currency: base },
          ...(otras ? [{ header: "Otras retenciones", kind: "money" as const, currency: base }] : []),
        ],
        rows: months.map((m) => [
          monthName(m.month),
          m.facturas,
          m.gravado,
          m.exento,
          m.totalSinItbis,
          m.itbis,
          m.total,
          m.itbisRetenido,
          m.isrRetenido,
          ...(otras ? [m.otrasRetenciones] : []),
        ]),
        totals: [
          "Total",
          totals.facturas,
          totals.gravado,
          totals.exento,
          totals.totalSinItbis,
          totals.itbis,
          totals.total,
          totals.itbisRetenido,
          totals.isrRetenido,
          ...(otras ? [totals.otrasRetenciones] : []),
        ],
      });
      sections.push({
        title: "Detalle por factura",
        columns: [
          { header: "Fecha", kind: "date" },
          { header: "Factura", kind: "text" },
          { header: "NCF", kind: "text" },
          { header: "Cliente", kind: "text" },
          { header: "Proyecto", kind: "text" },
          { header: "Moneda", kind: "text" },
          { header: "Total original", kind: "money" },
          { header: "Tasa", kind: "rate" },
          { header: "Gravado", kind: "money", currency: base },
          { header: "Exento", kind: "money", currency: base },
          { header: "ITBIS", kind: "money", currency: base },
          { header: "Total", kind: "money", currency: base },
          { header: "ITBIS retenido", kind: "money", currency: base },
          { header: "ISR retenido", kind: "money", currency: base },
          ...(otras ? [{ header: "Otras retenciones", kind: "money" as const, currency: base }] : []),
        ],
        rows: invoices.map((r) => [
          r.issueDate,
          r.number,
          r.ncf ?? "",
          r.clientName,
          r.projectNumber ?? "",
          r.currency,
          money(r.originalTotal, r.currency),
          r.rate,
          r.gravado,
          r.exento,
          r.itbis,
          r.total,
          r.itbisRetenido,
          r.isrRetenido,
          ...(otras ? [r.otrasRetenciones] : []),
        ]),
        totals: [
          "Total",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          totals.gravado,
          totals.exento,
          totals.itbis,
          totals.total,
          totals.itbisRetenido,
          totals.isrRetenido,
          ...(otras ? [totals.otrasRetenciones] : []),
        ],
      });
      notes.push(
        "Solo facturas emitidas (sin borradores ni canceladas). Gravado = venta que lleva ITBIS (sin el ITBIS); exento = venta sin ITBIS; gravado + exento = total sin ITBIS. Montos en la moneda base con la tasa de cada factura («Total original» y «Tasa» son la referencia de las facturas en otra moneda). Las retenciones son las que hizo el cliente (activas) y se muestran junto a su factura: no bajan la venta, son impuesto ya pagado a favor de la empresa.",
      );
      break;
    }

    case "gastos-categoria": {
      const rows = await getExpensesByCategoryReport({
        from: p.from,
        to: p.to,
        categoryId: p.category_id,
        projectId: p.project_id,
        supplierId: p.supplier_id,
        status: p.status,
      });
      const total = rows.reduce((a, r) => a + r.total, 0);
      summary.push({ label: "Total gastado", value: money(total, base) }, { label: "Categorías", value: rows.length });
      sections.push({
        columns: [
          { header: "Categoría", kind: "text" },
          { header: "Participación", kind: "percent" },
          { header: "Total gastado", kind: "money", currency: base },
        ],
        rows: rows.map((r) => [r.name, total > 0 ? (r.total / total) * 100 : null, r.total]),
        totals: ["Total", total > 0 ? 100 : null, total],
      });
      break;
    }

    case "flujo-categoria": {
      const origin = p.origin && p.origin in CASHFLOW_ORIGINS ? (p.origin as CashflowOrigin) : undefined;
      const direction = p.direction === "in" || p.direction === "out" ? p.direction : undefined;
      const r = await getCashflowByCategoryReport({
        from: p.from,
        to: p.to,
        bankAccountId: p.bank_account_id,
        projectId: p.project_id,
        clientId: p.client_id,
        supplierId: p.supplier_id,
        categoryId: p.category_id,
        origin,
        direction,
        includeTransfers: p.include_transfers === "1",
      });
      summary.push(
        { label: "Ingresos", value: money(r.totals.ingresos, base) },
        { label: "Egresos", value: money(r.totals.egresos, base) },
        { label: "Neto", value: money(r.totals.neto, base) },
      );
      if (r.uncategorized.count > 0) summary.push({ label: "Movimientos sin categoría", value: r.uncategorized.count });
      sections.push({
        title: "Resumen por categoría",
        columns: [
          { header: "Categoría", kind: "text" },
          { header: "Movimientos", kind: "number" },
          { header: "Ingresos", kind: "money", currency: base },
          { header: "Egresos", kind: "money", currency: base },
          { header: "Neto", kind: "money", currency: base },
        ],
        rows: r.rows.map((x) => [x.name, x.count, x.ingresos, x.egresos, x.neto]),
        totals: ["Total", r.rows.reduce((a, x) => a + x.count, 0), r.totals.ingresos, r.totals.egresos, r.totals.neto],
      });
      if (r.months.length > 0) {
        const monthName = (ym: string) => {
          const [y, m] = ym.split("-").map(Number);
          return new Intl.DateTimeFormat("es-DO", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
        };
        sections.push({
          title: "Neto por mes",
          note: "Positivo = ingreso neto; negativo = egreso neto.",
          columns: [
            { header: "Categoría", kind: "text" },
            ...r.months.map((m) => ({ header: monthName(m), kind: "money" as const, currency: base })),
            { header: "Total", kind: "money", currency: base },
          ],
          rows: r.rows.map((x) => [x.name, ...r.months.map((m) => x.byMonth[m] ?? 0), x.neto]),
          totals: ["Neto del mes", ...r.months.map((m) => r.rows.reduce((a, x) => a + (x.byMonth[m] ?? 0), 0)), r.totals.neto],
        });
      }
      notes.push(
        p.include_transfers === "1"
          ? "Incluye transferencias entre cuentas propias."
          : "Sin transferencias entre cuentas propias (no son ingreso ni gasto).",
        "Montos consolidados con la tasa guardada en cada movimiento.",
      );
      break;
    }

    case "por-moneda": {
      const direction = p.direction === "in" || p.direction === "out" ? p.direction : undefined;
      const r = await getPaymentsByCurrencyReport({
        from: p.from,
        to: p.to,
        direction,
        bankAccountId: p.bank_account_id,
        currency: p.currency,
        clientId: p.client_id,
        supplierId: p.supplier_id,
        onlyForeign: p.only_foreign === "1",
      });
      const fn = r.functionalCurrency;
      for (const c of r.summary.byAccountCurrency) {
        summary.push(
          { label: `Entró en cuentas ${c.currency}`, value: money(c.cobrado, c.currency) },
          { label: `Salió de cuentas ${c.currency}`, value: money(c.pagado, c.currency) },
          { label: `Comisiones ${c.currency}`, value: money(c.comisiones, c.currency) },
        );
      }
      summary.push(
        { label: `Diferencia informativa (${fn})`, value: money(r.summary.informativeTotal, fn) },
        { label: `Redondeo (${fn})`, value: money(r.summary.roundingTotal, fn) },
        { label: "En moneda diferente", value: `${r.summary.foreignCount} de ${r.summary.count}` },
      );
      sections.push({
        columns: [
          { header: "Fecha", kind: "date" },
          { header: "Tipo", kind: "text" },
          { header: "Documento", kind: "text" },
          { header: "Cliente / proveedor", kind: "text" },
          { header: "Aplicado", kind: "money" },
          { header: "Cuenta", kind: "text" },
          { header: "Banco", kind: "money" },
          { header: "Comisión", kind: "money" },
          { header: "Tasa efectiva", kind: "text" },
          { header: "Tasa referencia", kind: "rate" },
          { header: "Redondeo", kind: "money", currency: fn },
          { header: "Dif. informativa", kind: "money", currency: fn },
          { header: `Equivalente ${fn}`, kind: "money", currency: fn },
        ],
        rows: r.rows.map((x) => [
          x.date,
          x.direction === "COBRO" ? "Cobro" : "Pago",
          x.documentLabel,
          x.party,
          money(x.applied, x.documentCurrency),
          x.accountName,
          money(x.direction === "COBRO" ? x.bankAmount : -x.bankAmount, x.accountCurrency),
          x.fee > 0 ? money(x.fee, x.accountCurrency) : null,
          x.foreign && x.effectiveRate ? `1 ${x.effectiveRateCurrency} = ${x.effectiveRate}${x.manualRate ? " (manual)" : ""}` : null,
          x.foreign ? x.referenceRate : null,
          x.rounding || null,
          x.informative || null,
          x.functionalAmount,
        ]),
      });
      notes.push("La diferencia informativa no es ganancia ni pérdida contable: compara la tasa efectiva con la de referencia.");
      break;
    }

    case "retenciones-clientes": {
      const r = await getCustomerWithholdingsReport({
        from: p.from,
        to: p.to,
        clientId: p.client_id,
        type: p.wh_type,
        status: p.wh_status,
        onlyMissingCert: p.missing_cert === "1",
      });
      for (const t of r.summary.byType) {
        summary.push({ label: `${WH_TYPE[t.type] ?? t.type} retenido (${t.currency})`, value: money(t.total, t.currency) });
      }
      for (const c of r.summary.certificates) {
        summary.push({ label: `Según certificados (${c.currency})`, value: money(c.total, c.currency) });
      }
      summary.push({ label: "Sin certificado", value: r.summary.missingCert });
      sections.push({
        title: "Detalle de retenciones",
        columns: [
          { header: "Fecha", kind: "date" },
          { header: "Cliente", kind: "text" },
          { header: "Factura", kind: "text" },
          { header: "Tipo", kind: "text" },
          { header: "Monto", kind: "money" },
          { header: "N.º certificado", kind: "text" },
          { header: "Monto certificado", kind: "money" },
          { header: "Archivo", kind: "text" },
          { header: "Fecha del cobro", kind: "date" },
          { header: "Estado", kind: "text" },
          { header: "Motivo de anulación", kind: "text" },
        ],
        rows: r.rows.map((x) => [
          x.date,
          x.clientName,
          x.invoiceNumber,
          WH_TYPE[x.type] ?? x.type,
          money(x.amount, x.currency),
          x.certificateNumber ?? (x.hasDocument ? null : "Sin certificado"),
          x.certificateAmount !== null && x.certificateCurrency ? money(x.certificateAmount, x.certificateCurrency) : null,
          x.hasDocument ? "Sí" : "No",
          x.paymentDate,
          x.status === "VOIDED" ? "Anulada" : "Activa",
          x.voidReason,
        ]),
      });
      if (r.receivedVsApplied.length > 0) {
        sections.push({
          title: "Recibido en banco vs aplicado",
          note: "Cobros del período: dinero que entró al banco + retenciones = lo que rebajó las facturas (moneda de cada factura).",
          columns: [
            { header: "Moneda", kind: "text" },
            { header: "Recibido en banco", kind: "money" },
            { header: "Retenciones", kind: "money" },
            { header: "Aplicado", kind: "money" },
          ],
          rows: r.receivedVsApplied.map((x) => [x.currency, money(x.received, x.currency), money(x.withheld, x.currency), money(x.applied, x.currency)]),
        });
      }
      if (r.summary.byClient.length > 0) {
        sections.push({
          title: "Por cliente",
          columns: [
            { header: "Cliente", kind: "text" },
            { header: "Retenciones", kind: "number" },
            { header: "Total retenido", kind: "money" },
          ],
          rows: r.summary.byClient.map((c) => [c.client, c.count, money(c.total, c.currency)]),
        });
      }
      notes.push("Una retención cuenta como «sin certificado» si no tiene número ni archivo adjunto.");
      break;
    }
  }

  return { summary, sections, notes };
}

/** Totales por moneda: "Balance DOP", "Balance USD"… */
function totalsByCurrency(items: { amount: number; currency: string }[], label: string): ExportSummaryItem[] {
  const map = new Map<string, number>();
  for (const i of items) map.set(i.currency, (map.get(i.currency) ?? 0) + i.amount);
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, total]) => ({ label: `${label} ${currency}`, value: money(total, currency) }));
}

/** Arma los datos completos de un reporte para exportarlo. */
export async function buildReportExport(report: string, params: ReportExportParams): Promise<ReportExportData> {
  const meta = EXPORTABLE_REPORTS[report];
  if (!meta) throw new Error("unknown_report");
  const supabase = await createClient();
  const [{ data: company }, user] = await Promise.all([
    supabase.from("companies").select("name, legal_name, tax_id, logo_url, brand_primary, base_currency").single(),
    getCurrentUser(),
  ]);
  const base = company?.base_currency ?? "DOP";
  let generatedBy: string | null = null;
  if (user) {
    const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
    generatedBy = prof?.full_name ?? prof?.email ?? null;
  }
  const [filters, built] = await Promise.all([describeFilters(report, params), buildSections(report, params, base)]);
  const generatedAt = new Intl.DateTimeFormat("es-DO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Santo_Domingo",
  }).format(new Date());

  return {
    report,
    title: meta.title,
    description: meta.description,
    filters,
    generatedAt,
    generatedBy,
    company: {
      name: company?.name ?? "",
      legal_name: company?.legal_name ?? null,
      tax_id: company?.tax_id ?? null,
      logo_url: company?.logo_url ?? null,
      brand_primary: company?.brand_primary ?? "#0b0e14",
      base_currency: base,
    },
    ...built,
  };
}

