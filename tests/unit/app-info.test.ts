import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { APP_VERSION, RELEASE_DATE, copyrightText } from "@/lib/app-info";
import { LEGAL_DOCS } from "@/lib/legal/content";

describe("información del sistema", () => {
  it("la versión mostrada es la misma de package.json", () => {
    expect(APP_VERSION).toBe(pkg.version);
  });
  it("la fecha de actualización tiene formato AAAA-MM-DD", () => {
    expect(RELEASE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("derechos reservados con el año", () => {
    expect(copyrightText(2026)).toBe("Mindfreak Events © 2026. Todos los derechos reservados.");
  });
  it("política y términos tienen secciones con id único", () => {
    for (const doc of Object.values(LEGAL_DOCS)) {
      const ids = doc.sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(doc.sections.length).toBeGreaterThan(5);
    }
  });
});
