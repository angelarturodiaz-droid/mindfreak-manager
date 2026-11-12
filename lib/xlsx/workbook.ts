import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

/**
 * Excel (.xlsx) mínimo para las plantillas de carga masiva: escribir (hojas con texto, encabezado en negrita,
 * columnas en formato «Texto» y listas desplegables) y leer (la primera hoja o una por nombre, como texto).
 * Armado a mano con fflate, igual que lib/export/report-xlsx.ts, para no cargar una librería grande.
 * Funciones puras: corren en el navegador y en las pruebas.
 */

export type SheetSpec = {
  name: string;
  rows: string[][];
  /** Ancho de cada columna (caracteres). */
  widths?: number[];
  /** Columnas (índice 0) con formato «Texto»: Excel no les quita los ceros a la izquierda. */
  textColumns?: number[];
  /** Primera fila en negrita con fondo (encabezado). */
  header?: boolean;
  /** Listas desplegables: columna (índice 0) → rango de otra hoja, ej. "Listas!$A$2:$A$5". */
  lists?: { column: number; source: string }[];
  /** Hasta qué fila se aplican formatos y listas (por defecto 2000). */
  maxRows?: number;
  /** Inmovilizar la fila del encabezado. */
  freezeHeader?: boolean;
};

function esc(s: string): string {
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function colName(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// Estilos: 0 normal · 1 encabezado (negrita, fondo) · 2 texto (@) · 3 encabezado de texto.
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function sheetXml(s: SheetSpec): string {
  const text = new Set(s.textColumns ?? []);
  const maxRows = s.maxRows ?? 2000;
  const nCols = Math.max(s.widths?.length ?? 0, ...s.rows.map((r) => r.length), 1);
  const cols = Array.from({ length: nCols }, (_, i) => {
    const w = s.widths?.[i] ?? 16;
    return `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"${text.has(i) ? ' style="2"' : ""}/>`;
  }).join("");
  const rows = s.rows
    .map((r, ri) => {
      const isHeader = s.header && ri === 0;
      const cells = r
        .map((v, ci) => {
          const style = isHeader ? (text.has(ci) ? 3 : 1) : text.has(ci) ? 2 : 0;
          if (v === "" || v == null) return style ? `<c r="${colName(ci)}${ri + 1}" s="${style}"/>` : "";
          return `<c r="${colName(ci)}${ri + 1}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");
  const pane = s.freezeHeader
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : "";
  const validations = (s.lists ?? []).length
    ? `<dataValidations count="${s.lists!.length}">${s
        .lists!.map(
          (l) =>
            `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Valor no válido" error="Elige un valor de la lista." sqref="${colName(l.column)}2:${colName(l.column)}${maxRows}"><formula1>${esc(l.source)}</formula1></dataValidation>`,
        )
        .join("")}</dataValidations>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${pane}<cols>${cols}</cols><sheetData>${rows}</sheetData>${validations}</worksheet>`;
}

/** Arma el .xlsx con las hojas indicadas (la primera es la que se abre). */
export function buildWorkbook(sheets: SheetSpec[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  files["[Content_Types].xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join("")}</Types>`,
  );
  files["_rels/.rels"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  files["xl/workbook.xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
      .map((s, i) => `<sheet name="${esc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join("")}</sheets></workbook>`,
  );
  files["xl/_rels/workbook.xml.rels"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  files["xl/styles.xml"] = strToU8(STYLES);
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s));
  });
  return zipSync(files, { level: 6 });
}

// ---------------------------------------------------------------- lectura

function unesc(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

/** Texto de un <si> o <is>: une todos los <t> (texto con formato mixto). */
function runsText(xml: string): string {
  let out = "";
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out += m[1] ? unesc(m[1]) : "";
  return out;
}

/** Número de Excel como texto, sin notación científica ni «.0» de más. */
function numberText(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  if (Number.isInteger(n)) return BigInt(Math.round(n)).toString();
  return String(Math.round(n * 1e10) / 1e10);
}

export class WorkbookReadError extends Error {}

/**
 * Lee una hoja como tabla de textos (filas × columnas, sin filas vacías al final).
 * `sheetName`: si existe una hoja con ese nombre se usa; si no, la primera.
 */
export function readSheet(bytes: Uint8Array, sheetName?: string): { sheet: string; rows: string[][] } {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new WorkbookReadError("El archivo no es un Excel (.xlsx) válido. Guárdalo como «Libro de Excel (.xlsx)» e inténtalo de nuevo.");
  }
  const wb = files["xl/workbook.xml"];
  if (!wb) throw new WorkbookReadError("El archivo no es un Excel (.xlsx) válido.");
  const wbXml = strFromU8(wb);
  const relsXml = files["xl/_rels/workbook.xml.rels"] ? strFromU8(files["xl/_rels/workbook.xml.rels"]) : "";
  const sheets = [...wbXml.matchAll(/<sheet\b[^>]*\bname="([^"]*)"[^>]*\br:id="([^"]*)"[^>]*\/?>/g)].map((m) => ({
    name: unesc(m[1]),
    rid: m[2],
  }));
  if (sheets.length === 0) throw new WorkbookReadError("El Excel no tiene hojas.");
  const wanted = sheetName
    ? sheets.find((s) => s.name.trim().toLowerCase() === sheetName.trim().toLowerCase()) ?? sheets[0]
    : sheets[0];
  const rel = new RegExp(`<Relationship\\b[^>]*\\bId="${wanted.rid}"[^>]*\\bTarget="([^"]*)"`).exec(relsXml)
    ?? new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]*)"[^>]*\\bId="${wanted.rid}"`).exec(relsXml);
  let target = rel ? rel[1] : "worksheets/sheet1.xml";
  target = target.replace(/^\/?xl\//, "").replace(/^\//, "");
  const sheetFile = files[`xl/${target}`];
  if (!sheetFile) throw new WorkbookReadError("No se pudo leer la hoja del Excel.");

  const shared: string[] = [];
  if (files["xl/sharedStrings.xml"]) {
    const ss = strFromU8(files["xl/sharedStrings.xml"]);
    for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(runsText(m[1]));
  }

  const xml = strFromU8(sheetFile);
  const grid: string[][] = [];
  for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rAttr = /\br="(\d+)"/.exec(rm[1]);
    const rowIdx = rAttr ? Number(rAttr[1]) - 1 : grid.length;
    const row: string[] = [];
    let nextCol = 0;
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const inner = cm[2] ?? "";
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs);
      const ci = ref ? colIndex(ref[1]) : nextCol;
      nextCol = ci + 1;
      const t = /\bt="([^"]+)"/.exec(attrs)?.[1];
      let value = "";
      if (t === "inlineStr") value = runsText(/<is>([\s\S]*?)<\/is>/.exec(inner)?.[1] ?? "");
      else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
        if (v != null) {
          if (t === "s") value = shared[Number(v)] ?? "";
          else if (t === "str" || t === "e") value = unesc(v);
          else if (t === "b") value = v === "1" ? "VERDADERO" : "FALSO";
          else value = numberText(v);
        }
      }
      row[ci] = value.replace(/\r\n?/g, "\n");
    }
    grid[rowIdx] = Array.from({ length: row.length }, (_, i) => row[i] ?? "");
  }
  const rows = Array.from({ length: grid.length }, (_, i) => grid[i] ?? []);
  while (rows.length && rows[rows.length - 1].every((c) => !c || !c.trim())) rows.pop();
  return { sheet: wanted.name, rows };
}
