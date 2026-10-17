import { describe, expect, it } from "vitest";
import { allowedReports, canSeeComparisons, canSeeReport } from "@/features/reports/access";

const ventas = ["clients.view", "quotations.view", "projects.view", "reports.view"];
const finanzas = ["reports.view", "invoices.view", "expenses.view", "payments.view", "banks.view"];

describe("reportes por rol", () => {
  it("Ventas no ve reportes de dinero", () => {
    expect(allowedReports(ventas)).toEqual([]);
    expect(canSeeComparisons(ventas)).toBe(false);
  });
  it("Finanzas ve todos", () => {
    expect(allowedReports(finanzas)).toHaveLength(9);
    expect(canSeeComparisons(finanzas)).toBe(true);
  });
  it("sin Ver reportes no ve ninguno", () => {
    expect(canSeeReport("cxc", ["invoices.view"])).toBe(false);
  });
});
