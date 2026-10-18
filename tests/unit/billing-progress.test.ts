import { describe, expect, it } from "vitest";
import { billingProgress } from "@/features/projects/billing-progress";

describe("billingProgress (cotizado vs. facturado)", () => {
  it("sin cotización aprobada no compara", () => {
    const r = billingProgress({ cotizado: 0, facturado: 5000 });
    expect(r.state).toBe("none");
    expect(r.pct).toBeNull();
    expect(r.borradoresExceden).toBe(false);
  });

  it("anticipo del 50 %: falta por facturar", () => {
    const r = billingProgress({ cotizado: 100000, facturado: 50000 });
    expect(r.state).toBe("pending");
    expect(r.restante).toBe(50000);
    expect(r.pct).toBe(50);
  });

  it("anticipo + balance: completo (tolera redondeos)", () => {
    expect(billingProgress({ cotizado: 100000, facturado: 100000 }).state).toBe("complete");
    expect(billingProgress({ cotizado: 100000, facturado: 99999.5 }).state).toBe("complete");
  });

  it("facturado de más", () => {
    const r = billingProgress({ cotizado: 100000, facturado: 120000 });
    expect(r.state).toBe("over");
    expect(r.restante).toBe(-20000);
  });

  it("avisa si al emitir los borradores se pasaría", () => {
    const r = billingProgress({ cotizado: 100000, facturado: 50000, borradores: 60000 });
    expect(r.state).toBe("pending");
    expect(r.borradoresExceden).toBe(true);
    expect(r.excesoConBorradores).toBe(10000);
  });

  it("borradores que completan justo no avisan", () => {
    const r = billingProgress({ cotizado: 100000, facturado: 50000, borradores: 50000 });
    expect(r.borradoresExceden).toBe(false);
    expect(r.excesoConBorradores).toBe(0);
  });
});
