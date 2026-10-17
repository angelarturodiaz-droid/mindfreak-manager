import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { cellText, exportFileName, fmtDateISO, type ReportExportData } from "@/features/reports/export-types";
import { buildReportXlsx } from "@/lib/export/report-xlsx";

const base: ReportExportData = {
  report: "cxc",
  title: "Cuentas por cobrar",
  description: "Facturas con balance pendiente.",
  filters: ["Cliente: A & B <prueba>"],
  generatedAt: "16/10/26",
  generatedBy: null,
  company: { name: "Mindfreak", legal_name: null, tax_id: null, logo_url: null, brand_primary: "#0b0e14", base_currency: "DOP" },
  summary: [{ label: "Balance USD", value: { money: 1400, currency: "USD" } }],
  sections: [
    {
      columns: [
        { header: "Factura", kind: "text" },
        { header: "Vencimiento", kind: "date" },
        { header: "Balance", kind: "money" },
        { header: "Margen", kind: "percent" },
      ],
      rows: [["INV-0027", "2026-10-11", { money: 1400, currency: "USD" }, 12.5]],
      totals: ["Total", null, { money: 1400, currency: "USD" }, null],
    },
  ],
  notes: [],
};

describe("cellText", () => {
  it("formatea dinero, fechas, porcentajes y vacíos", () => {
    expect(cellText({ money: 1400, currency: "USD" }, { header: "", kind: "money" })).toContain("1,400.00");
    expect(cellText("2026-10-11", { header: "", kind: "date" })).toBe("11/10/2026");
    expect(cellText(12.5, { header: "", kind: "percent" })).toBe("12.5%");
    expect(cellText(null, { header: "", kind: "text" })).toBe("—");
    expect(fmtDateISO("2026-01-05")).toBe("05/01/2026");
  });

  it("nombre de archivo sin caracteres inválidos", () => {
    expect(exportFileName({ ...base, title: "Ventas / cliente" }, "xlsx")).toMatch(/^Ventas - cliente - \d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});

describe("buildReportXlsx", () => {
  const files = unzipSync(buildReportXlsx(base));
  const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
  const styles = strFromU8(files["xl/styles.xml"]);

  it("trae las partes de un .xlsx válido", () => {
    for (const f of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml"]) {
      expect(files[f]).toBeDefined();
    }
  });

  it("guarda números y fechas como valores, y escapa el texto", () => {
    expect(sheet).toContain("<v>1400</v>");
    expect(sheet).toContain("<v>46306</v>"); // 11/10/2026 como número de serie de Excel
    expect(sheet).toContain("<v>0.125</v>"); // 12.5 % → 0.125 con formato 0.0%
    expect(sheet).toContain("A &amp; B &lt;prueba&gt;");
    expect(styles).toContain("US$");
  });
});

import { pageWindow } from "@/components/ui/pagination";
describe("pageWindow", () => {
  it("muestra todas si son pocas y recorta con … si son muchas", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
    expect(pageWindow(1, 12)).toEqual([1, 2, null, 12]);
    expect(pageWindow(3, 12)).toEqual([1, 2, 3, 4, null, 12]);
    expect(pageWindow(12, 12)).toEqual([1, null, 11, 12]);
  });
});
