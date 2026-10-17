/**
 * Datos de un reporte listos para exportar (Excel o PDF). Los arma el
 * servidor (features/reports/export-data.ts) con TODAS las filas del filtro,
 * no solo la página que se ve; el navegador genera el archivo.
 */

export type ExportColumnKind = "text" | "money" | "number" | "date" | "percent" | "rate";

export type ExportColumn = {
  header: string;
  kind: ExportColumnKind;
  /** Moneda fija de la columna (si cada fila trae la suya, va en la celda). */
  currency?: string;
};

/** Celda: texto, número, fecha ISO (YYYY-MM-DD) o dinero con su moneda. */
export type ExportCell = string | number | null | { money: number; currency: string };

export type ExportSection = {
  title?: string;
  note?: string;
  columns: ExportColumn[];
  rows: ExportCell[][];
  /** Fila de totales (opcional). */
  totals?: ExportCell[];
};

export type ExportSummaryItem = { label: string; value: ExportCell };

export type ReportExportData = {
  report: string;
  title: string;
  description: string;
  /** "Desde: 01/10/2026", "Cliente: Juan"… vacío = sin filtros. */
  filters: string[];
  /** Fecha y hora de generación (ya formateada, hora de RD). */
  generatedAt: string;
  generatedBy: string | null;
  company: {
    name: string;
    legal_name: string | null;
    tax_id: string | null;
    logo_url: string | null;
    brand_primary: string;
    base_currency: string;
  };
  summary: ExportSummaryItem[];
  sections: ExportSection[];
  notes: string[];
};

const moneyFmt = new Map<string, Intl.NumberFormat>();
export function fmtMoney(amount: number, currency: string): string {
  let f = moneyFmt.get(currency);
  if (!f) {
    try {
      f = new Intl.NumberFormat("es-DO", { style: "currency", currency });
    } catch {
      f = new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    moneyFmt.set(currency, f);
  }
  return f.format(amount);
}

/** YYYY-MM-DD → dd/mm/aaaa (sin zona horaria). */
export function fmtDateISO(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Texto de una celda tal como se ve (PDF y anchos de columna en Excel). */
export function cellText(cell: ExportCell, col: ExportColumn): string {
  if (cell === null || cell === undefined || cell === "") return "—";
  if (typeof cell === "object") return fmtMoney(cell.money, cell.currency);
  if (typeof cell === "number") {
    switch (col.kind) {
      case "money":
        return fmtMoney(cell, col.currency ?? "DOP");
      case "percent":
        return `${cell.toFixed(1)}%`;
      case "rate":
        return new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(cell);
      default:
        return new Intl.NumberFormat("es-DO").format(cell);
    }
  }
  if (col.kind === "date") return fmtDateISO(cell);
  return cell;
}

/** Nombre de archivo: "Cuentas por cobrar - 2026-10-16.xlsx". */
export function exportFileName(data: ReportExportData, ext: "xlsx" | "pdf"): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(new Date());
  const safe = data.title.replace(/[\\/:*?"<>|]/g, "-");
  return `${safe} - ${today}.${ext}`;
}
