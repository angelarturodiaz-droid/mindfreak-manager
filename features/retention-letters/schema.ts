/**
 * 4b — Carta de retención a proveedores (constancia de retención de ISR/ITBIS).
 * Solo lee lo que ya está en el gasto: no calcula impuestos.
 */

export type LetterAddressee = "DGII" | "SUPPLIER" | "WHOM";

export const ADDRESSEE_LABELS: Record<LetterAddressee, string> = {
  DGII: "Director(a) General de la DGII",
  SUPPLIER: "Al proveedor",
  WHOM: "A quien pueda interesar",
};

export const ADDRESSEE_INFO: Record<LetterAddressee, string> = {
  DGII: "Como se hace normalmente: dirigida al Director General de la DGII. El nombre se cambia en Configuración → Documentos.",
  SUPPLIER: "Dirigida al proveedor por su nombre (útil si el proveedor la pide así).",
  WHOM: "Sin destinatario específico («A quien pueda interesar»).",
};

export const DEFAULT_LEGAL_TEXT =
  "Las retenciones detalladas fueron realizadas en virtud de la Ley 253-12 y sus modificaciones, de acuerdo con lo dispuesto en la Norma General 02-05 de fecha 17 de enero de 2005, modificada por la Norma General 07-09 de fecha 1 de septiembre de 2009.";

export type RetentionLetterRow = {
  invoiceDate: string;
  ncf: string | null;
  total: number;
  tax: number;
  retentionDate: string;
  itbisWithheld: number;
  isrWithheld: number;
  netPaid: number;
};

export type RetentionLetterData = {
  company: {
    name: string;
    legal_name: string | null;
    tax_id: string | null;
    address: string | null;
    phone: string | null;
    logo_url: string | null;
    brand_primary: string;
    brand_accent: string;
  };
  number: string;
  letterDate: string;
  addressee: { mode: LetterAddressee; name: string | null; title: string | null };
  supplier: { name: string; tax_id: string | null };
  rows: RetentionLetterRow[];
  currency: string;
  itbisPct: number;
  isrPct: number;
  legalText: string;
  signer: { name: string | null; title: string | null };
  expenseDescription: string;
};

/** Porcentaje legible: 100, 30, 2, 10, 2.5 (sin ceros de más). */
export function pctLabel(value: number): string {
  const r = Math.round(value * 100) / 100;
  return `${Number.isInteger(r) ? r : r.toFixed(2).replace(/0$/, "")} %`;
}

/**
 * Porcentajes del texto, calculados de lo retenido en el gasto:
 * ITBIS retenido ÷ ITBIS facturado; ISR retenido ÷ base sin ITBIS.
 */
export function retentionPercents(e: { subtotal: number; tax: number; isrWithheld: number; itbisWithheld: number }) {
  const itbisPct = e.tax > 0 ? (e.itbisWithheld / e.tax) * 100 : 0;
  const isrPct = e.subtotal > 0 ? (e.isrWithheld / e.subtotal) * 100 : 0;
  return { itbisPct, isrPct };
}

/** Párrafo principal de la carta. */
export function letterParagraph(d: Pick<RetentionLetterData, "itbisPct" | "isrPct" | "supplier">): string {
  const rnc = d.supplier.tax_id ? `, RNC/Cédula ${d.supplier.tax_id}` : "";
  return (
    `Por medio de la presente certificamos que retuvimos el ${pctLabel(d.itbisPct)} del ITBIS facturado ` +
    `(Impuesto sobre la Transferencia de Bienes Industrializados y Servicios) y el ${pctLabel(d.isrPct)} ` +
    `del Impuesto sobre la Renta (ISR), correspondiente a la(s) factura(s) del proveedor ${d.supplier.name}${rnc}, ` +
    `detalladas a continuación:`
  );
}

export function retentionLetterErrorMessage(message: string): string {
  if (message.includes("no_withholding")) return "Este gasto no tiene retenciones de ISR ni de ITBIS: no lleva carta de retención.";
  if (message.includes("no_payment")) return "La retención se hace al pagar: registra primero el pago al proveedor y luego genera la carta.";
  if (message.includes("insufficient_privilege")) return "No tienes permiso para emitir cartas de retención.";
  const i = message.indexOf(": ");
  return i > 0 ? message.slice(i + 2) : message;
}
