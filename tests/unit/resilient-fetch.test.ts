import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));

import { resilientFetch } from "@/lib/supabase/server";

describe("conexión con Supabase: reintento ante cortes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reintenta una lectura (GET) que falla por un corte y luego funciona", async () => {
    const ok = new Response("[]", { status: 200 });
    const fake = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(ok);
    vi.stubGlobal("fetch", fake);
    const res = await resilientFetch("https://x.supabase.co/rest/v1/assets?select=*", { method: "GET" });
    expect(res.status).toBe(200);
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it("reintenta la consulta de permisos (solo lee)", async () => {
    const fake = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(new Response("true"));
    vi.stubGlobal("fetch", fake);
    await resilientFetch("https://x.supabase.co/rest/v1/rpc/has_permission", { method: "POST", body: "{}" });
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it("NUNCA reintenta un guardado (POST/PATCH): no se duplica nada", async () => {
    const fake = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fake);
    await expect(resilientFetch("https://x.supabase.co/rest/v1/assets", { method: "POST", body: "{}" })).rejects.toThrow("fetch failed");
    await expect(resilientFetch("https://x.supabase.co/rest/v1/rpc/register_customer_payment", { method: "POST", body: "{}" })).rejects.toThrow();
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it("se rinde después de 3 intentos", async () => {
    const fake = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fake);
    await expect(resilientFetch("https://x.supabase.co/rest/v1/assets", { method: "GET" })).rejects.toThrow();
    expect(fake).toHaveBeenCalledTimes(3);
  });
});
