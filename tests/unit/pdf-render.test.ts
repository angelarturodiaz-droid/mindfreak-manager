import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { QuotationPdfDocument } from "@/lib/pdf/quotation-document";
import { InvoicePdfDocument } from "@/lib/pdf/invoice-document";
import fs from "fs";

describe("PDF render smoke test", () => {
  it("renders the redesigned quotation PDF without throwing", async () => {
    const buffer = await renderToBuffer(
      QuotationPdfDocument({
        company: {
          name: "Mindfreak Manager",
          legal_name: "Mindfreak Events SRL",
          tax_id: "133-22341-4",
          logo_url: null,
          brand_primary: "#000000",
          brand_accent: "#17a6b8",
        },
        quotation: {
          number: "COT-2026-053",
          issue_date: "2026-06-29",
          valid_until: "2026-07-28",
          status: "DRAFT",
          currency: "DOP",
          subtotal: 168000,
          discount: 0,
          tax: 30240,
          total: 198240,
          terms: "50% anticipo, 50% al finalizar",
        },
        client: { name: "Engel Rivas (We 2 Sec)", tax_id: null, email: null, phone: null },
        items: [
          {
            description:
              'Alquiler de Stand: impresión full color, material banner matte.\nIncluye: TV 55", 4 sillas altas, Mesa alta.',
            quantity: 1,
            unit_price: 138000,
            discount: 0,
            subtotal: 138000,
          },
          {
            description: "Transporte SDQ - PC - SDQ",
            quantity: 1,
            unit_price: 30000,
            discount: 0,
            subtotal: 30000,
          },
        ],
      }),
    );
    expect(buffer.length).toBeGreaterThan(1000);
    fs.writeFileSync("/tmp/test-quotation.pdf", buffer);
  });

  it("renders the redesigned invoice PDF without throwing", async () => {
    const buffer = await renderToBuffer(
      InvoicePdfDocument({
        company: {
          name: "Mindfreak Manager",
          legal_name: "Mindfreak Events SRL",
          tax_id: "133-22341-4",
          logo_url: null,
          brand_primary: "#000000",
          brand_accent: "#17a6b8",
        },
        invoice: {
          number: "FAC-0001",
          issue_date: "2026-09-15",
          due_date: "2026-10-15",
          status: "ISSUED",
          currency: "DOP",
          subtotal: 168000,
          discount: 0,
          tax: 30240,
          total: 198240,
          paid_amount: 0,
          balance: 198240,
          ncf: null,
        },
        client: { name: "Engel Rivas", tax_id: null, email: "engel@test.com", phone: "809-000-0000" },
        items: [
          {
            description: "Alquiler de Stand",
            quantity: 1,
            unit_price: 138000,
            discount: 0,
            subtotal: 138000,
          },
        ],
      }),
    );
    expect(buffer.length).toBeGreaterThan(1000);
    fs.writeFileSync("/tmp/test-invoice.pdf", buffer);
  });
});
