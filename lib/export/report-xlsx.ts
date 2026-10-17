import { strToU8, zipSync } from "fflate";
import { cellText, type ExportCell, type ExportColumn, type ReportExportData } from "@/features/reports/export-types";

/**
 * Excel (.xlsx) de un reporte, armado a mano (SpreadsheetML mínimo + zip con
 * fflate) para no cargar una librería grande. Números y fechas quedan como
 * valores reales (se pueden sumar, ordenar y filtrar); el dinero lleva el
 * formato de su moneda (RD$, US$…).
 */

const CURRENCY_PREFIX: Record<string, string> = { DOP: "RD$", USD: "US$", EUR: "€" };

function esc(s: string): string {
  return s
    // Caracteres de control no válidos en XML.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colName(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Fecha YYYY-MM-DD → número de serie de Excel. */
function excelDate(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return utc / 86400000 + 25569;
}

/** Estilos: se arman según las monedas que aparezcan. */
class Styles {
  private numFmts: string[] = [];
  private xfs: string[] = [];
  private keyToXf = new Map<string, number>();
  constructor() {
    // 0 = normal (obligatorio).
    this.xfs.push('<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>');
  }
  private fmtId(code: string): number {
    const i = this.numFmts.indexOf(code);
    if (i >= 0) return 164 + i;
    this.numFmts.push(code);
    return 164 + this.numFmts.length - 1;
  }
  /** font: 0 normal, 1 negrita, 2 título, 3 gris; fill: 0 nada, 2 encabezado, 3 total. */
  get(key: { fmt?: string; font?: number; fill?: number; border?: boolean; wrap?: boolean }): number {
    const k = JSON.stringify(key);
    const hit = this.keyToXf.get(k);
    if (hit !== undefined) return hit;
    const numFmtId = key.fmt ? this.fmtId(key.fmt) : 0;
    const font = key.font ?? 0;
    const fill = key.fill ?? 0;
    const border = key.border ? 1 : 0;
    const align = key.wrap ? '<alignment wrapText="1" vertical="top"/>' : "";
    this.xfs.push(
      `<xf numFmtId="${numFmtId}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0"` +
        `${numFmtId ? ' applyNumberFormat="1"' : ""}${font ? ' applyFont="1"' : ""}${fill ? ' applyFill="1"' : ""}` +
        `${border ? ' applyBorder="1"' : ""}${align ? ' applyAlignment="1">' + align + "</xf>" : "/>"}`,
    );
    const id = this.xfs.length - 1;
    this.keyToXf.set(k, id);
    return id;
  }
  xml(brand: string): string {
    const rgb = "FF" + brand.replace("#", "").toUpperCase().padStart(6, "0").slice(0, 6);
    const fmts = this.numFmts.length
      ? `<numFmts count="${this.numFmts.length}">${this.numFmts
          .map((c, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(c)}"/>`)
          .join("")}</numFmts>`
      : "";
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      fmts +
      '<fonts count="4">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
      `<font><b/><sz val="15"/><color rgb="${rgb}"/><name val="Calibri"/></font>` +
      '<font><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/></font>' +
      "</fonts>" +
      '<fills count="4">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF7"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill>' +
      "</fills>" +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left/><right/><top/><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join("")}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      "</styleSheet>"
    );
  }
}

function moneyFormat(currency: string): string {
  const p = CURRENCY_PREFIX[currency] ?? `${currency} `;
  const q = `"${p}"`;
  return `${q}#,##0.00;-${q}#,##0.00`;
}

type Cell = { ref: string; xml: string };

export function buildReportXlsx(data: ReportExportData): Uint8Array {
  const st = new Styles();
  const rows: string[] = [];
  const merges: string[] = [];
  const widths: number[] = [];
  let r = 0;

  const maxCols = Math.max(2, ...data.sections.map((s) => s.columns.length));
  const track = (c: number, text: string) => {
    widths[c] = Math.max(widths[c] ?? 8, Math.min(60, text.length + 2));
  };

  const textCell = (c: number, text: string, style = 0): Cell => ({
    ref: `${colName(c)}${r + 1}`,
    xml: `<c r="${colName(c)}${r + 1}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${esc(text)}</t></is></c>`,
  });
  const numCell = (c: number, n: number, style = 0): Cell => ({
    ref: `${colName(c)}${r + 1}`,
    xml: `<c r="${colName(c)}${r + 1}"${style ? ` s="${style}"` : ""}><v>${Number.isFinite(n) ? n : 0}</v></c>`,
  });
  const pushRow = (cells: Cell[], height?: number) => {
    rows.push(`<row r="${r + 1}"${height ? ` ht="${height}" customHeight="1"` : ""}>${cells.map((x) => x.xml).join("")}</row>`);
    r++;
  };
  const fullRow = (text: string, style: number, height?: number) => {
    merges.push(`A${r + 1}:${colName(maxCols - 1)}${r + 1}`);
    pushRow([textCell(0, text, style)], height);
  };

  // Encabezado
  fullRow(data.company.legal_name || data.company.name, st.get({ font: 1 }));
  fullRow(data.title, st.get({ font: 2 }), 22);
  fullRow(data.description, st.get({ font: 3 }));
  fullRow(
    `Generado: ${data.generatedAt}${data.generatedBy ? ` por ${data.generatedBy}` : ""}${data.company.tax_id ? ` · RNC ${data.company.tax_id}` : ""}`,
    st.get({ font: 3 }),
  );
  fullRow(data.filters.length ? `Filtros: ${data.filters.join(" · ")}` : "Filtros: ninguno (todo)", st.get({ font: 3 }));
  r++; // línea en blanco

  // Resumen (etiqueta | valor)
  if (data.summary.length) {
    pushRow([textCell(0, "Resumen", st.get({ font: 1 }))]);
    for (const s of data.summary) {
      const cells: Cell[] = [textCell(0, s.label)];
      track(0, s.label);
      const v = s.value;
      if (v && typeof v === "object") {
        cells.push(numCell(1, v.money, st.get({ fmt: moneyFormat(v.currency), font: 1 })));
        track(1, cellText(v, { header: "", kind: "money" }));
      } else if (typeof v === "number") {
        cells.push(numCell(1, v, st.get({ font: 1 })));
      } else if (v) {
        cells.push(textCell(1, v, st.get({ font: 1 })));
        track(1, v);
      }
      pushRow(cells);
    }
    r++;
  }

  const cellXml = (c: number, cell: ExportCell, col: ExportColumn, bold: boolean, fill?: number): Cell | null => {
    const font = bold ? 1 : 0;
    if (cell === null || cell === undefined || cell === "") return fill ? textCell(c, "", st.get({ font, fill })) : null;
    track(c, cellText(cell, col));
    if (typeof cell === "object") return numCell(c, cell.money, st.get({ fmt: moneyFormat(cell.currency), font, fill }));
    if (typeof cell === "number") {
      if (col.kind === "money") return numCell(c, cell, st.get({ fmt: moneyFormat(col.currency ?? data.company.base_currency), font, fill }));
      if (col.kind === "percent") return numCell(c, cell / 100, st.get({ fmt: "0.0%", font, fill }));
      if (col.kind === "rate") return numCell(c, cell, st.get({ fmt: "#,##0.00####", font, fill }));
      return numCell(c, cell, st.get({ fmt: "#,##0", font, fill }));
    }
    if (col.kind === "date") {
      const serial = excelDate(cell);
      if (serial !== null) return numCell(c, serial, st.get({ fmt: "dd/mm/yyyy", font, fill }));
    }
    return textCell(c, cell, st.get({ font, fill }));
  };

  for (const sec of data.sections) {
    if (sec.title) pushRow([textCell(0, sec.title, st.get({ font: 1 }))], 18);
    if (sec.note) pushRow([textCell(0, sec.note, st.get({ font: 3 }))]);
    const head = st.get({ font: 1, fill: 2, border: true });
    pushRow(
      sec.columns.map((col, c) => {
        track(c, col.header);
        return textCell(c, col.header, head);
      }),
    );
    if (sec.rows.length === 0) {
      pushRow([textCell(0, "Sin datos con estos filtros.", st.get({ font: 3 }))]);
    }
    for (const row of sec.rows) {
      pushRow(sec.columns.map((col, c) => cellXml(c, row[c] ?? null, col, false)).filter((x): x is Cell => x !== null));
    }
    if (sec.totals) {
      pushRow(sec.columns.map((col, c) => cellXml(c, sec.totals![c] ?? null, col, true, 3)).filter((x): x is Cell => x !== null));
    }
    r++;
  }

  if (data.notes.length) {
    pushRow([textCell(0, "Notas", st.get({ font: 1 }))]);
    for (const n of data.notes) fullRow(n, st.get({ font: 3 }));
  }

  const cols = Array.from({ length: maxCols }, (_, i) => {
    const w = Math.max(10, widths[i] ?? 10);
    return `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`;
  }).join("");

  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>' +
    `<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols>` +
    `<sheetData>${rows.join("")}</sheetData>` +
    (merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "") +
    '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
    '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
    "</worksheet>";

  const sheetName = esc(data.title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        "</Types>",
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        "</Relationships>",
    ),
    "docProps/core.xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        `<dc:title>${esc(data.title)}</dc:title><dc:creator>${esc(data.company.name || "Mindfreak Manager")}</dc:creator>` +
        `<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>` +
        "</cp:coreProperties>",
    ),
    "xl/workbook.xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        "</Relationships>",
    ),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
    "xl/styles.xml": strToU8(st.xml(data.company.brand_primary || "#0b0e14")),
  };
  return zipSync(files, { level: 6 });
}
