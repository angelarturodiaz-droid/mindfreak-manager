import { describe, expect, it } from "vitest";
import { DOC_PREFIX, nextDocNumber } from "@/lib/utils/doc-number";

describe("número interno de documentos", () => {
  it("facturas y proyectos con prefijo en español", () => {
    expect(DOC_PREFIX.invoice).toBe("FAC");
    expect(DOC_PREFIX.project).toBe("PROY");
  });
  it("sigue la numeración aunque las anteriores tengan otro prefijo", () => {
    expect(nextDocNumber("FAC", ["INV-0035", "INV-0036"])).toBe("FAC-0037");
    expect(nextDocNumber("PROY", ["PROJ-0005", "PROJ-0002"])).toBe("PROY-0006");
  });
  it("mezcla de prefijos y huecos: toma el mayor", () => {
    expect(nextDocNumber("FAC", ["INV-0036", "FAC-0040", null, "FAC-0038"])).toBe("FAC-0041");
  });
  it("sin documentos empieza en 0001", () => {
    expect(nextDocNumber("FAC", [])).toBe("FAC-0001");
  });
});
