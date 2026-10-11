import { describe, it, expect } from "vitest";
import { accentPattern, cleanSearch, searchOr, stripAccents } from "@/lib/utils/search";

describe("search", () => {
  it("limpia el texto", () => {
    expect(cleanSearch("  Pago, (parcial) 50% ")).toBe("Pago parcial 50");
    expect(cleanSearch("   ")).toBeUndefined();
    expect(cleanSearch("Producción")).toBe("Producción");
  });
  it("busca con o sin tildes", () => {
    const re = (q: string) => new RegExp(accentPattern(q), "i");
    expect(re("produccion").test("Producción Integral")).toBe(true);
    expect(re("PRODUCCIÓN").test("produccion")).toBe(true);
    expect(re("pádel").test("Torneo de Padel")).toBe(true);
    expect(re("diseno").test("Diseño Gráfico")).toBe(true);
    expect(re("señalizacion").test("Senalizacion")).toBe(true);
    expect(re("coctel").test("Cóctel / Picadera")).toBe(true);
    expect(re("coffee").test("Catering")).toBe(false);
    expect(stripAccents("Iluminación")).toBe("iluminacion");
  });
  it("arma el or de PostgREST", () => {
    expect(searchOr("ab", ["number"], { column: "client_id", ids: ["x", "y"] })).toBe(
      'number.imatch."[aáàäâ]b",client_id.in.(x,y)',
    );
  });
});
