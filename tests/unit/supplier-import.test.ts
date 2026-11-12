import { describe, expect, it } from "vitest";
import { buildWorkbook, readSheet, WorkbookReadError } from "@/lib/xlsx/workbook";
import {
  SUPPLIER_IMPORT_COLUMNS,
  SUPPLIER_IMPORT_SHEET,
  supplierErrorSheets,
  supplierTemplateSheets,
  validateSupplierRows,
  type ImportCatalogs,
} from "@/features/suppliers/import";

const catalogs: ImportCatalogs = {
  categories: [
    { id: "c1", name: "Audiovisuales" },
    { id: "c2", name: "Alimentos y bebidas" },
  ],
  serviceTypes: [
    { id: "t1", name: "Sonido", category_id: "c1" },
    { id: "t2", name: "Disc jockey", category_id: "c1" },
    { id: "t3", name: "Catering", category_id: "c2" },
  ],
  banks: ["Banco Popular", "BHD"],
  existingTaxIds: ["101000001"],
  existingNames: ["Proveedor Viejo"],
};

const H = SUPPLIER_IMPORT_COLUMNS.map((c) => c.header);
function row(v: Partial<Record<string, string>>): string[] {
  return SUPPLIER_IMPORT_COLUMNS.map((c) => v[c.key] ?? "");
}

describe("Excel mínimo (lib/xlsx)", () => {
  it("escribe y vuelve a leer la misma tabla (acentos, ceros, símbolos)", () => {
    const rows = [
      ["Nombre", "RNC o cédula", "Nota"],
      ["Sonido & Luz «Pro»", "00112345678", "línea 1"],
      ["", "", ""],
      ["Ñoño", "131234567", "<b>"],
    ];
    const bytes = buildWorkbook([{ name: "Proveedores", rows, header: true, textColumns: [1] }, { name: "Otra", rows: [["x"]] }]);
    const back = readSheet(bytes, "proveedores");
    expect(back.sheet).toBe("Proveedores");
    expect(back.rows[1]).toEqual(rows[1]);
    expect(back.rows[3]).toEqual(rows[3]);
    expect(readSheet(bytes, "Otra").rows).toEqual([["x"]]);
  });

  it("rechaza un archivo que no es Excel", () => {
    expect(() => readSheet(new TextEncoder().encode("nombre,rnc\nA,1"))).toThrow(WorkbookReadError);
  });

  it("la plantilla trae la hoja Proveedores con los encabezados, Instrucciones y Listas", () => {
    const sheets = supplierTemplateSheets(catalogs);
    const bytes = buildWorkbook(sheets);
    expect(readSheet(bytes, SUPPLIER_IMPORT_SHEET).rows).toEqual([H]);
    const lists = readSheet(bytes, "Listas").rows;
    expect(lists[0][6]).toBe("Categoría");
    expect(lists.map((r) => r[7]).filter(Boolean)).toContain("Disc jockey");
    expect(readSheet(bytes, "Instrucciones").rows.length).toBeGreaterThan(SUPPLIER_IMPORT_COLUMNS.length);
  });
});

describe("A3 · revisión de filas de proveedores", () => {
  it("exige la columna Nombre", () => {
    expect(validateSupplierRows([["RNC"], ["1"]], catalogs).error).toMatch(/Nombre/);
  });

  it("fila completa y correcta → lista, con categoría deducida del tipo de servicio", () => {
    const { results } = validateSupplierRows(
      [
        H,
        row({
          name: "Sonido Pro SRL",
          tax_id: "131-23456-7",
          supplier_kind: "Persona Jurídica",
          fiscal_condition: "Registrado DGII",
          e_issuer: "Sí",
          service_type: "sonido",
          email: "Ventas@SonidoPro.com",
          bank_name: "banco popular",
          contact_name: "Ana",
        }),
      ],
      catalogs,
    );
    expect(results[0].status).toBe("ok");
    const r = results[0].record!;
    expect(r.tax_id).toBe("131234567");
    expect(r.id_type).toBe("RNC");
    expect(r.category_id).toBe("c1");
    expect(r.service_type_id).toBe("t1");
    expect(r.e_issuer).toBe("SI");
    expect(r.email).toBe("ventas@sonidopro.com");
    expect(r.bank_name).toBe("Banco Popular");
    expect(r.contact?.full_name).toBe("Ana");
  });

  it("detecta errores: RNC corto, existente, repetido, categoría inexistente, tipo de otra categoría, correo", () => {
    const { results } = validateSupplierRows(
      [
        H,
        row({ name: "A", tax_id: "12345678" }),
        row({ name: "B", tax_id: "101000001" }),
        row({ name: "C", tax_id: "131111111" }),
        row({ name: "D", tax_id: "131111111" }),
        row({ name: "E", category: "Sonido2" }),
        row({ name: "F", category: "Alimentos y bebidas", service_type: "Sonido" }),
        row({ name: "G", email: "no-es-correo" }),
      ],
      catalogs,
    );
    const byName = Object.fromEntries(results.map((r) => [r.name, r]));
    expect(byName.A.status).toBe("error");
    expect(byName.B.messages[0].text).toMatch(/Ya existe/);
    expect(byName.C.status).not.toBe("error");
    expect(byName.D.messages.some((m) => /Repetido/.test(m.text))).toBe(true);
    expect(byName.E.messages[0].text).toMatch(/no existe/);
    expect(byName.F.messages.some((m) => /no pertenece/.test(m.text))).toBe(true);
    expect(byName.G.messages.some((m) => /Correo inválido/.test(m.text))).toBe(true);
    for (const r of results.filter((x) => x.status === "error")) expect(r.record).toBeNull();
  });

  it("avisos: sin datos fiscales, cédula sin el cero inicial, banco fuera del catálogo, extranjero sin país = error", () => {
    const { results } = validateSupplierRows(
      [
        H,
        row({ name: "DJ Fiesta", id_type: "Cédula", tax_id: "1123456789", bank_name: "Banco X" }),
        row({ name: "Supplies Inc", tax_residence: "Extranjero" }),
        row({ name: "Supplies 2", tax_residence: "Extranjero", country: "Estados Unidos", foreign_tax_id: "12-3" }),
      ],
      catalogs,
    );
    const dj = results[0];
    expect(dj.status).toBe("warn");
    expect(dj.record!.tax_id).toBe("01123456789");
    expect(dj.messages.map((m) => m.text).join(" ")).toMatch(/por revisar/);
    expect(dj.messages.map((m) => m.text).join(" ")).toMatch(/catálogo de bancos/);
    expect(dj.messages.map((m) => m.text).join(" ")).toMatch(/Sugerencia por el nombre: Audiovisuales · Disc jockey/);
    expect(results[1].status).toBe("error");
    expect(results[2].record!.country_code).toBe("US");
    expect(results[2].record!.tax_residence).toBe("EXTRANJERO");
  });

  it("ignora filas vacías y el Excel de errores se puede volver a subir", () => {
    const { results } = validateSupplierRows([H, row({}), row({ name: "X", tax_id: "1" })], catalogs);
    expect(results).toHaveLength(1);
    const bytes = buildWorkbook(supplierErrorSheets(results));
    const again = validateSupplierRows(readSheet(bytes, SUPPLIER_IMPORT_SHEET).rows, catalogs);
    expect(again.error).toBeNull();
    expect(again.results[0].name).toBe("X");
  });
});
