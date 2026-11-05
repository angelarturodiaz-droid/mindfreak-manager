/**
 * 5b — «Datos para el Facturador DGII»: arma, en el mismo orden y numeración del Facturador Gratuito,
 * lo que ya está en la factura. Solo LEE y ordena: los impuestos de cada línea son los que ya calculó el ERP.
 */
import { ECF_TYPES, INCOME_TYPES, PAYMENT_TYPES, placeName, provinceName, unitName } from "@/lib/dgii/catalogs";

export type FacturadorRow = { n: string; label: string; value: string; copy?: string; note?: string; muted?: boolean };
export type FacturadorLine = {
  index: number;
  description: string;
  unit: string;
  kind: string;
  quantity: string;
  price: string;
  itbis: string;
  discount: string;
  value: string;
  isCommission?: boolean;
};
export type FacturadorData = {
  header: FacturadorRow[];
  lines: FacturadorLine[];
  options: FacturadorRow[];
  totals: FacturadorRow[];
  checks: { ok: boolean; text: string }[];
  totalMatches: boolean;
  currency: string;
};

type Treatment = "GRAVADO" | "EXENTO" | "NO_SUJETO" | string | null;

export type FacturadorInput = {
  invoice: {
    number: string;
    issue_date: string;
    ncf_type: string | null;
    payment_type_code: string | null;
    income_type: string | null;
    ecf_comments: string | null;
    credit_days: number | null;
    payment_terms_name: string | null;
    currency: string;
    total: number;
    commission_amount: number | null;
    commission_tax_treatment: Treatment;
    commission_tax_rate_percent: number | null;
  };
  client: {
    name: string;
    tax_id: string | null;
    foreign_id: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    province_code: string | null;
    municipality_code: string | null;
  };
  items: {
    description: string;
    unit_code: string | null;
    item_kind: string | null;
    quantity: number;
    unit_price: number;
    discount: number;
    tax: number;
    tax_treatment: Treatment;
    tax_rate_percent: number | null;
  }[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Monto para escribir en el Facturador: sin símbolo, con punto decimal (ej. 100000.00). */
export const plain = (n: number) => r2(n).toFixed(2);
const show = (n: number) => r2(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => (Number.isInteger(n) ? String(n) : String(r2(n)));

function itbisLabel(treatment: Treatment, rate: number | null): string {
  if (treatment === "EXENTO" || treatment === "NO_SUJETO") return "Exento";
  return `${r2(Number(rate ?? 0))}%`;
}

function bucket(treatment: Treatment, rate: number | null): "18" | "16" | "0" | "EX" {
  if (treatment === "EXENTO" || treatment === "NO_SUJETO") return "EX";
  const r = Number(rate ?? 0);
  if (r === 18) return "18";
  if (r === 16) return "16";
  return "0";
}

export function buildFacturadorData(input: FacturadorInput): FacturadorData {
  const { invoice: inv, client, items } = input;
  const ecfType = inv.ncf_type && /^\d{2}$/.test(inv.ncf_type) ? inv.ncf_type : "31";
  const paymentCode = inv.payment_type_code || ((inv.credit_days ?? 0) > 0 ? "2" : "1");
  const term = inv.credit_days ? `${inv.credit_days} días` : inv.payment_terms_name ?? "—";
  const taxId = (client.tax_id ?? "").replace(/\D/g, "");

  const header: FacturadorRow[] = [
    { n: "1", label: "Tipo de e-CF", value: ECF_TYPES.find((t) => t.value === ecfType)?.label ?? ecfType, copy: ecfType },
    { n: "2", label: "Fecha de emisión", value: inv.issue_date.split("-").reverse().join("/"), copy: inv.issue_date.split("-").reverse().join("/") },
    { n: "3", label: "Tipo de pago", value: PAYMENT_TYPES.find((t) => t.value === paymentCode)?.label ?? paymentCode, copy: paymentCode },
    { n: "4", label: "Tipo de ingreso", value: INCOME_TYPES.find((t) => t.value === (inv.income_type ?? "01"))?.label ?? "01", copy: inv.income_type ?? "01" },
    { n: "5", label: "Término de pago", value: term, copy: term === "—" ? undefined : term, muted: term === "—" },
    { n: "6", label: "RNC / Cédula del cliente", value: taxId || "—", copy: taxId || undefined, muted: !taxId },
    { n: "7", label: "ID extranjero", value: client.foreign_id || "— (solo clientes del exterior)", copy: client.foreign_id || undefined, muted: !client.foreign_id },
    { n: "8", label: "Razón social", value: client.name, copy: client.name },
    { n: "9", label: "Teléfono", value: client.phone || "—", copy: client.phone || undefined, muted: !client.phone },
    { n: "10", label: "Comentarios", value: inv.ecf_comments || `— (sugerido: ${inv.number})`, copy: inv.ecf_comments || inv.number, muted: !inv.ecf_comments },
    { n: "11", label: "Correo", value: client.email || "—", copy: client.email || undefined, muted: !client.email },
    { n: "12", label: "Dirección", value: client.address || "—", copy: client.address || undefined, muted: !client.address },
    { n: "13", label: "Provincia", value: provinceName(client.province_code) ?? "— (opcional)", copy: provinceName(client.province_code) ?? undefined, muted: !client.province_code },
    { n: "14", label: "Municipio", value: placeName(client.municipality_code) ?? "— (opcional)", copy: placeName(client.municipality_code) ?? undefined, muted: !client.municipality_code },
  ];

  const sums = { "18": { base: 0, tax: 0 }, "16": { base: 0, tax: 0 }, "0": { base: 0, tax: 0 }, EX: { base: 0, tax: 0 } };
  const lines: FacturadorLine[] = items.map((it, i) => {
    const base = it.quantity * it.unit_price - it.discount;
    const b = bucket(it.tax_treatment, it.tax_rate_percent);
    sums[b].base += base;
    sums[b].tax += b === "EX" ? 0 : it.tax;
    return {
      index: i + 1,
      description: it.description,
      unit: unitName(it.unit_code),
      kind: (it.item_kind ?? "SERVICIO") === "BIEN" ? "Bien" : "Servicio",
      quantity: qty(it.quantity),
      price: plain(it.unit_price),
      itbis: itbisLabel(it.tax_treatment, it.tax_rate_percent),
      discount: plain(it.discount),
      value: plain(base),
    };
  });

  // La comisión de agencia del ERP va como una línea más (servicio), con su ITBIS.
  const commission = Number(inv.commission_amount ?? 0);
  if (commission > 0) {
    const b = bucket(inv.commission_tax_treatment, inv.commission_tax_rate_percent);
    const tax = b === "EX" || b === "0" ? 0 : r2(commission * (Number(inv.commission_tax_rate_percent ?? 0) / 100));
    sums[b].base += commission;
    sums[b].tax += tax;
    lines.push({
      index: lines.length + 1,
      description: "Comisión de agencia",
      unit: "Unidad",
      kind: "Servicio",
      quantity: "1",
      price: plain(commission),
      itbis: itbisLabel(inv.commission_tax_treatment, inv.commission_tax_rate_percent),
      discount: plain(0),
      value: plain(commission),
      isCommission: true,
    });
  }

  const g18 = r2(sums["18"].base), g16 = r2(sums["16"].base), g0 = r2(sums["0"].base);
  const i18 = r2(sums["18"].tax), i16 = r2(sums["16"].tax), i0 = 0;
  const ex = r2(sums.EX.base);
  const subGravado = r2(g18 + g16 + g0);
  const subItbis = r2(i18 + i16 + i0);
  const total = r2(subGravado + subItbis + ex);
  const t = (n: string, label: string, v: number, note?: string): FacturadorRow => ({ n, label, value: show(v), copy: plain(v), note, muted: v === 0 });

  const totals: FacturadorRow[] = [
    t("27", "Total gravado 18%", g18),
    t("28", "Total gravado 16%", g16),
    t("29", "Total gravado 0%", g0),
    t("30", "ITBIS 18%", i18),
    t("31", "ITBIS 16%", i16),
    t("32", "ITBIS 0%", i0),
    t("33", "SubTotal gravado (27 + 28 + 29)", subGravado),
    t("34", "SubTotal ITBIS (30 + 31 + 32)", subItbis),
    t("35", "SubTotal exento", ex),
    t("36", "Propina legal", 0, "No se activa en eventos"),
    t("37", "Total ITBIS retenido", 0, "Bloqueado en tipo 31: no forzar"),
    t("38", "Total ISR retenido", 0, "Bloqueado en tipo 31: no forzar"),
    t("39", "Monto total (gravado + ITBIS + exento + propina)", total, "El e-CF NO resta retenciones"),
  ];

  const options: FacturadorRow[] = [
    { n: "22–23", label: "ITBIS / ISR retenido en la línea", value: "No aplican en una venta 31 (bloqueados)", muted: true },
    { n: "25", label: "Redondear monto total", value: "Apagado", muted: true },
    { n: "26", label: "Propina legal", value: "No activar (es para comidas y bebidas en el local)", muted: true },
  ];

  const totalMatches = Math.abs(total - r2(inv.total)) < 0.02;
  const checks = [
    { ok: ecfType !== "31" || taxId.length > 0, text: ecfType === "31" ? (taxId ? "Tipo 31 con el RNC/cédula del cliente." : "Tipo 31 necesita el RNC o la cédula del cliente: complétalo en su ficha.") : `Tipo ${ecfType}.` },
    { ok: !(ecfType === "32" && taxId.length === 9), text: ecfType === "32" && taxId.length === 9 ? "El cliente tiene RNC de empresa: ¿no debería ser 31 Crédito fiscal?" : "Tipo de e-CF acorde con el cliente." },
    { ok: !(paymentCode === "3" && total > 0), text: paymentCode === "3" && total > 0 ? "«Gratuito» es para entregas sin pago: esta factura tiene monto." : "Tipo de pago acorde con la factura." },
    { ok: lines.length > 0, text: lines.length ? `${lines.length} línea(s) para pasar.` : "La factura no tiene líneas." },
    { ok: totalMatches, text: totalMatches ? `El total (${show(total)}) cuadra con la factura del ERP.` : `El total calculado (${show(total)}) no cuadra con la factura (${show(inv.total)}): revisa descuentos e impuestos antes de emitir.` },
    { ok: inv.currency === "DOP", text: inv.currency === "DOP" ? "Factura en pesos (DOP)." : `Factura en ${inv.currency}: en el Facturador elige esa moneda y su tasa.` },
  ];

  return { header, lines, options, totals, checks, totalMatches, currency: inv.currency };
}
