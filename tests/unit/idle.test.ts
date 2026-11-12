import { describe, expect, it } from "vitest";
import { idleState, sanitizeIdleMinutes } from "@/lib/session/idle";

describe("cierre por inactividad", () => {
  const t0 = 1_000_000_000_000;
  it("activo, aviso en el último minuto y vencido", () => {
    expect(idleState(t0, t0 + 28 * 60_000, 30).phase).toBe("active");
    expect(idleState(t0, t0 + 29 * 60_000 + 10_000, 30)).toEqual({ phase: "warning", secondsLeft: 50 });
    expect(idleState(t0, t0 + 30 * 60_000, 30).phase).toBe("expired");
    expect(idleState(t0, t0 + 3 * 3_600_000, 30).phase).toBe("expired");
  });
  it("valores raros vuelven a 30 y el mínimo es 5", () => {
    expect(sanitizeIdleMinutes(undefined)).toBe(30);
    expect(sanitizeIdleMinutes("abc")).toBe(30);
    expect(sanitizeIdleMinutes(1)).toBe(30);
    expect(sanitizeIdleMinutes(60)).toBe(60);
    expect(idleState(t0, t0 + 4 * 60_000, 1).phase).toBe("warning");
  });
});
