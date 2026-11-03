import { describe, expect, it } from "vitest";
import { cleanLink, directoryNextStep, formatPriceText } from "@/features/directory/schema";

describe("directorio (5)", () => {
  it("acepta enlaces web y les pone https si falta", () => {
    expect(cleanLink("instagram.com/mago")).toBe("https://instagram.com/mago");
    expect(cleanLink("https://youtu.be/x")).toBe("https://youtu.be/x");
    expect(cleanLink("")).toBeNull();
  });
  it("rechaza enlaces que no son web", () => {
    expect(cleanLink("javascript:alert(1)")).toBeNull();
    expect(cleanLink("hola mundo")).toBeNull();
    expect(cleanLink("hola")).toBeNull();
    expect(cleanLink("https://hola/")).toBeNull();
  });
  it("precio de referencia con comas y punto", () => {
    expect(formatPriceText("15000")).toBe("RD$15,000.00");
    expect(formatPriceText("15,000.5")).toBe("RD$15,000.50");
    expect(formatPriceText("desde RD$15000 por hora")).toBe("desde RD$15,000.00 por hora");
    expect(formatPriceText("desde 15000 por show")).toBe("desde 15,000.00 por show");
    expect(formatPriceText("US$ 800 por día")).toBe("US$800.00 por día");
    expect(formatPriceText("3 horas para 100 personas")).toBe("3 horas para 100 personas");
    expect(formatPriceText("tarifa 2026: 25000")).toBe("tarifa 2026: 25,000.00");
    expect(formatPriceText("")).toBe("");
  });
  it("siguiente paso guía Prospecto → Evaluado → Aprobado → Proveedor", () => {
    expect(directoryNextStep("PROSPECTO").to).toBe("EVALUADO");
    expect(directoryNextStep("EVALUADO").to).toBe("APROBADO");
    expect(directoryNextStep("APROBADO").button).toBe("Convertir en proveedor");
    expect(directoryNextStep("PROVEEDOR").to).toBeNull();
  });
});
