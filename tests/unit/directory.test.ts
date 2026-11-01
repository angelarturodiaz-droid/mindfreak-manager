import { describe, expect, it } from "vitest";
import { cleanLink, directoryNextStep } from "@/features/directory/schema";

describe("directorio (5)", () => {
  it("acepta enlaces web y les pone https si falta", () => {
    expect(cleanLink("instagram.com/mago")).toBe("https://instagram.com/mago");
    expect(cleanLink("https://youtu.be/x")).toBe("https://youtu.be/x");
    expect(cleanLink("")).toBeNull();
  });
  it("rechaza enlaces que no son web", () => {
    expect(cleanLink("javascript:alert(1)")).toBeNull();
  });
  it("siguiente paso guía Prospecto → Evaluado → Aprobado → Proveedor", () => {
    expect(directoryNextStep("PROSPECTO").to).toBe("EVALUADO");
    expect(directoryNextStep("EVALUADO").to).toBe("APROBADO");
    expect(directoryNextStep("APROBADO").button).toBe("Convertir en proveedor");
    expect(directoryNextStep("PROVEEDOR").to).toBeNull();
  });
});
