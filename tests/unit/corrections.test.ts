import { describe, expect, it } from "vitest";
import { correctionErrorMessage, whatWillHappen } from "@/features/corrections/schema";

describe("correcciones (V1-4)", () => {
  it("anular un cobro explica el reverso y que la factura vuelve a deber", () => {
    const lines = whatWillHappen("customer_payment", "VOID", {});
    expect(lines.join(" ")).toContain("Reverso");
    expect(lines.join(" ")).toContain("La factura vuelve a deber");
  });

  it("cambiar monto explica anular + registrar de nuevo", () => {
    const lines = whatWillHappen("supplier_payment", "CHANGE", { amount: true });
    expect(lines.join(" ")).toContain("se crea uno nuevo");
    expect(lines.join(" ")).toContain("El gasto queda debiendo");
  });

  it("cambiar solo la fecha no mueve dinero", () => {
    const lines = whatWillHappen("bank_transaction", "CHANGE", { date: true });
    expect(lines.join(" ")).toContain("El dinero no cambia");
  });

  it("traduce los errores de la base a mensajes sencillos", () => {
    expect(correctionErrorMessage("reconciled_locked: x")).toContain("conciliado");
    expect(correctionErrorMessage("same_user: x")).toContain("otra persona");
    expect(correctionErrorMessage("algo_raro: Texto claro")).toBe("Texto claro");
  });
});
