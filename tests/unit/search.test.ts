import { describe, it, expect } from "vitest";
import { cleanSearch, searchOr } from "@/lib/utils/search";
describe("search", () => {
  it("cleans", () => {
    expect(cleanSearch("  Pago, (parcial) 50% ")).toBe("Pago parcial 50");
    expect(cleanSearch("   ")).toBeUndefined();
  });
  it("builds or", () => {
    expect(searchOr("S.R.L.", ["number"], { column: "client_id", ids: ["a", "b"] })).toBe('number.ilike."%S.R.L.%",client_id.in.(a,b)');
  });
});
