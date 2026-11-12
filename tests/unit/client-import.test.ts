import { describe, expect, it } from "vitest";
import { buildWorkbook, readSheet } from "@/lib/xlsx/workbook";
import { CLIENT_IMPORT_COLUMNS, CLIENT_IMPORT_SHEET, clientErrorSheets, clientTemplateSheets, validateClientRows } from "@/features/clients/import";

const H = CLIENT_IMPORT_COLUMNS.map((c) => c.header);
const row = (v: Partial<Record<string, string>>) => CLIENT_IMPORT_COLUMNS.map((c) => v[c.key] ?? "");
const cat = { existingTaxIds: ["101000001"], existingNames: ["Cliente Viejo"] };

describe("A4 · plantilla de clientes", () => {
  it("trae Clientes, Instrucciones y Listas con provincias y municipios", () => {
    const bytes = buildWorkbook(clientTemplateSheets());
    expect(readSheet(bytes, CLIENT_IMPORT_SHEET).rows).toEqual([H]);
    const lists = readSheet(bytes, "Listas").rows;
    expect(lists.map((r) => r[2])).toContain("Santiago");
    expect(lists.map((r) => r[4])).toContain("Santo Domingo Este");
  });
});

describe("A4 · revisión de filas de clientes", () => {
  it("cliente completo con dos contactos → listo", () => {
    const { results } = validateClientRows(
      [
        H,
        row({
          name: "Banco Prueba SA",
          tax_id: "131-00000-2",
          email: "eventos@bancoprueba.com",
          province: "santo domingo",
          municipality: "Santo Domingo Este",
          c1_name: "María",
          c1_email: "maria@bancoprueba.com",
          c1_billing: "No",
          c2_name: "Pedro",
          c2_email: "cxp@bancoprueba.com",
        }),
      ],
      cat,
    );
    const r = results[0];
    expect(r.status).toBe("ok");
    expect(r.record!.stage).toBe("CLIENT");
    expect(r.record!.province_code).toMatch(/^\d{6}$/);
    expect(r.record!.municipality_code).toMatch(/^\d{6}$/);
    expect(r.record!.contacts).toEqual([
      expect.objectContaining({ full_name: "María", is_primary: true, receives_billing: false }),
      expect.objectContaining({ full_name: "Pedro", is_primary: false, receives_billing: true }),
    ]);
  });

  it("lead sin RNC ni contactos → sin avisos de cobro; cliente sin RNC → aviso", () => {
    const { results } = validateClientRows([H, row({ name: "Luisa", stage: "Lead" }), row({ name: "Pepe" })], cat);
    expect(results[0].status).toBe("ok");
    expect(results[0].record!.stage).toBe("LEAD");
    expect(results[1].status).toBe("warn");
    expect(results[1].messages.map((m) => m.text).join(" ")).toMatch(/crédito fiscal/);
    expect(results[1].messages.map((m) => m.text).join(" ")).toMatch(/Nadie recibirá/);
  });

  it("errores: RNC existente, repetido, largo raro, etapa, provincia, municipio de otra provincia, correos", () => {
    const { results } = validateClientRows(
      [
        H,
        row({ name: "A", tax_id: "101000001" }),
        row({ name: "B", tax_id: "131111112" }),
        row({ name: "C", tax_id: "131111112" }),
        row({ name: "D", tax_id: "12345" }),
        row({ name: "E", stage: "Cliente VIP" }),
        row({ name: "F", province: "Narnia" }),
        row({ name: "G", province: "Santiago", municipality: "Santo Domingo Este" }),
        row({ name: "H", c2_name: "X", c2_email: "malo" }),
      ],
      cat,
    );
    const by = Object.fromEntries(results.map((r) => [r.name, r]));
    expect(by.A.messages[0].text).toMatch(/Ya existe/);
    expect(by.B.status).not.toBe("error");
    expect(by.C.messages[0].text).toMatch(/Repetido/);
    expect(by.D.status).toBe("error");
    expect(by.E.status).toBe("error");
    expect(by.F.messages[0].text).toMatch(/provincia/);
    expect(by.G.messages[0].text).toMatch(/no es de la provincia/);
    expect(by.H.status).toBe("error");
  });

  it("el Excel de errores se puede volver a subir", () => {
    const { results } = validateClientRows([H, row({ name: "X", tax_id: "1" })], cat);
    const again = validateClientRows(readSheet(buildWorkbook(clientErrorSheets(results)), CLIENT_IMPORT_SHEET).rows, cat);
    expect(again.results[0].name).toBe("X");
  });
});
