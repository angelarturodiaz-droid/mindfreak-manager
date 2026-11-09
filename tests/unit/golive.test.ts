import { describe, expect, it } from "vitest";
import { CHECK_LABELS, checksFrom, golivePreviewFrom } from "@/features/golive/types";

describe("A1 · lectura de la vista previa de la limpieza Go-Live", () => {
  it("suma los registros y lee listas, conservados y respaldo", () => {
    const p = golivePreviewFrom({
      preview_id: "abc",
      counts: [
        { key: "invoices", label: "Facturas", count: 38 },
        { key: "clients", label: "Clientes", count: "5" },
        { key: "approvals", label: "Aprobaciones", count: 0 },
      ],
      kept: { services: 116, assets: "15" },
      lists: { clients: ["Cliente A"], suppliers: ["Proveedor B"], bank_accounts: ["BHD (DOP)"], assets: [] },
      file_count: 76,
      backup_ok: true,
      backup_at: "2026-11-09T00:17:55Z",
      company_name: "Empresa Ejemplo",
    });
    expect(p.previewId).toBe("abc");
    expect(p.total).toBe(43);
    expect(p.kept).toEqual({ services: 116, assets: 15 });
    expect(p.lists.bankAccounts).toEqual(["BHD (DOP)"]);
    expect(p.fileCount).toBe(76);
    expect(p.backupOk).toBe(true);
    expect(p.companyName).toBe("Empresa Ejemplo");
  });

  it("tolera respuestas vacías sin romperse", () => {
    const p = golivePreviewFrom(null);
    expect(p.total).toBe(0);
    expect(p.backupOk).toBe(false);
    expect(p.lists.clients).toEqual([]);
  });
});

describe("A1 · comprobaciones posteriores", () => {
  it("lee cada comprobación y todas tienen su explicación", () => {
    const c = checksFrom({
      ran: true,
      run_at: "2026-11-09T00:40:00Z",
      checks: [
        { key: "empty", ok: true, detail: [] },
        { key: "orphans", ok: true, detail: {} },
        { key: "kept", ok: true, detail: [] },
        { key: "files", ok: false, detail: 3 },
        { key: "audit", ok: true, detail: 0 },
      ],
    });
    expect(c.ran).toBe(true);
    expect(c.checks.filter((x) => !x.ok).map((x) => x.key)).toEqual(["files"]);
    for (const x of c.checks) expect(CHECK_LABELS[x.key]).toBeDefined();
  });

  it("sin limpieza todavía", () => {
    expect(checksFrom({ ran: false }).ran).toBe(false);
  });
});
