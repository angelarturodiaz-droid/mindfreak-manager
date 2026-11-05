import { describe, expect, it } from "vitest";
import { ecfFileKind } from "@/features/invoices/ecf-file-kind";

describe("ecfFileKind", () => {
  it("reconoce PDF y XML por extensión o tipo", () => {
    expect(ecfFileKind("E310000000999.pdf", "")).toBe("pdf");
    expect(ecfFileKind("e-cf.XML", "")).toBe("xml");
    expect(ecfFileKind("archivo", "text/xml")).toBe("xml");
    expect(ecfFileKind("foto.jpg", "image/jpeg")).toBeNull();
  });
});
