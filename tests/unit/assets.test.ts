import { describe, expect, it } from "vitest";
import { assetErrorMessage, describeAssetEventValue, formatQuantity, ASSET_STATUS_LABELS } from "@/features/assets/schema";

describe("activos (5c)", () => {
  it("cantidad sin decimales de más", () => {
    expect(formatQuantity(3)).toBe("3");
    expect(formatQuantity("15.00")).toBe("15");
    expect(formatQuantity(1.5)).toBe("1.5");
  });
  it("historial en palabras", () => {
    expect(describeAssetEventValue("status", "EN_REPARACION")).toBe("En reparación");
    expect(describeAssetEventValue("value", "DOP 2135.00")).toBe("RD$2,135.00");
    expect(describeAssetEventValue("value", "USD 50")).toBe("US$50.00");
    expect(describeAssetEventValue("location", null)).toBe("—");
    expect(describeAssetEventValue("quantity", "20.00")).toBe("20");
  });
  it("estados y errores en español", () => {
    expect(ASSET_STATUS_LABELS.DADO_DE_BAJA).toBe("Dado de baja");
    expect(assetErrorMessage('new row violates row-level security policy for table "assets"')).toBe("No tienes permiso para este cambio.");
    expect(assetErrorMessage("duplicate key value violates unique constraint uq_asset_locations_name")).toBe("Ese nombre ya existe en la lista.");
  });
});
