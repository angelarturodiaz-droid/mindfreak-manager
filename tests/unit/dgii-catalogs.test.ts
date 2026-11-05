import { describe, expect, it } from "vitest";
import { PROVINCES, placesOfProvince, placeName, placeInProvince, provinceName, titleCase, unitName, UNITS, UNITS_COMMON, INCOME_TYPES, ECF_TYPES } from "@/lib/dgii/catalogs";

describe("listas DGII (5b)", () => {
  it("32 provincias con el código e-CF", () => {
    expect(PROVINCES).toHaveLength(32);
    expect(provinceName("010000")).toBe("Distrito Nacional");
    expect(provinceName("140000")).toBe("María Trinidad Sánchez");
    expect(provinceName("320000")).toBe("Santo Domingo");
  });
  it("municipios agrupados con sus distritos", () => {
    const sd = placesOfProvince("320000");
    expect(sd.map((g) => g.municipio.name)).toContain("Santo Domingo Este");
    const higuey = placesOfProvince("110000").find((g) => g.municipio.name === "Higüey")!;
    expect(higuey.distritos.map((d) => d.name)).toContain("Verón Punta Cana (Incluye Bávaro)");
    expect(placeName("320101")).toBe("Santo Domingo Este (distrito municipal)");
    expect(placeName("320100")).toBe("Santo Domingo Este");
    expect(placesOfProvince("010000")).toHaveLength(1);
  });
  it("el municipio debe ser de la provincia", () => {
    expect(placeInProvince("320100", "320000")).toBe(true);
    expect(placeInProvince("250100", "320000")).toBe(false);
  });
  it("nombres en mayúsculas y minúsculas correctas", () => {
    expect(titleCase("SAN FRANCISCO DE MACORÍS")).toBe("San Francisco de Macorís");
    expect(titleCase("LAS BARÍAS-LA ESTANCIA")).toBe("Las Barías-La Estancia");
  });
  it("unidades de medida, tipos de ingreso y de e-CF", () => {
    expect(UNITS).toHaveLength(62);
    expect(unitName("43")).toBe("Unidad");
    expect(unitName(null)).toBe("Unidad");
    expect(UNITS_COMMON[0].value).toBe("43");
    expect(INCOME_TYPES[0].value).toBe("01");
    expect(ECF_TYPES.some((t) => t.value === "41")).toBe(false);
  });
});
