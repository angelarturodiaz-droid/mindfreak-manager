import { describe, expect, it } from "vitest";
import { dbErrorMessage } from "@/lib/utils/db-error";

describe("dbErrorMessage", () => {
  it("quita el código de los errores de documentos bloqueados", () => {
    expect(dbErrorMessage("issued_invoice_locked: la factura ya fue emitida; sus líneas no se pueden cambiar.")).toBe(
      "La factura ya fue emitida; sus líneas no se pueden cambiar.",
    );
    expect(dbErrorMessage("locked_quotation: la cotización ya no está en Borrador")).toBe(
      "La cotización ya no está en Borrador",
    );
  });
  it("deja igual los demás errores", () => {
    expect(dbErrorMessage("duplicate key value")).toBe("duplicate key value");
  });
});
