import { describe, expect, it } from "vitest";
import { COUNTRIES, countryName, formatClientLocation, matchCountry, matchRegion, regionLabel, regionsOf } from "@/lib/geo/countries";

describe("lib/geo · países y estados", () => {
  it("lista completa en español, sin repetidos", () => {
    expect(COUNTRIES.length).toBeGreaterThan(240);
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    expect(countryName("PR")).toBe("Puerto Rico");
    expect(countryName("DO")).toBe("República Dominicana");
  });

  it("reconoce países y estados escritos de varias formas", () => {
    expect(matchCountry("rd")).toBe("DO");
    expect(matchCountry("EE. UU.")).toBe("US");
    expect(matchCountry("panama")).toBe("PA");
    expect(matchCountry("Narnia")).toBeNull();
    expect(matchRegion("US", "New York")).toBe("Nueva York");
    expect(matchRegion("US", "fl")).toBe("Florida");
    expect(regionsOf("PR")).toHaveLength(78);
    expect(regionLabel("PA")).toBe("Provincia o comarca");
    expect(regionsOf("FR")).toBeNull();
  });

  it("ubicación en una línea", () => {
    expect(formatClientLocation({ country_code: "US", region: "Florida", city: "Miramar" })).toBe("Miramar, Florida, Estados Unidos");
    expect(formatClientLocation({ country_code: "PR" })).toBe("Puerto Rico");
    expect(formatClientLocation({ country_code: "DO" })).toBe("");
  });
});
