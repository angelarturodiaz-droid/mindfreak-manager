import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Facturas y cobros", () => {
  test("crear factura, agregar línea, emitir y registrar el cobro completo", async ({
    page,
  }) => {
    await login(page);

    await page.goto("/invoices/new");
    await page.locator('select[name="client_id"]').selectOption({ index: 1 });
    await page.getByRole("button", { name: /crear factura/i }).click();
    await expect(page.getByText("Borrador", { exact: true })).toBeVisible();

    await page.locator('input[name="description"]').fill("Línea E2E factura");
    await page.locator('input[name="quantity"]').fill("1");
    // MoneyInput: el input visible no tiene "name" (eso está en un input
    // oculto sincronizado) — se ubica por su label en su lugar.
    await page.getByLabel(/precio/i).fill("2000");
    await page.getByRole("button", { name: /agregar línea/i }).click();
    await expect(page.getByText("Línea E2E factura")).toBeVisible();

    await page.getByRole("button", { name: /emitir factura/i }).click();
    await expect(page.getByText(/emitida/i)).toBeVisible();

    // El monto ya viene precargado con el balance completo, pero la cuenta
    // bancaria es obligatoria y no trae valor por defecto — hay que elegirla.
    await page.locator('select[name="bank_account_id"]').selectOption({ index: 1 });
    await page.getByRole("button", { name: /registrar cobro/i }).click();
    await expect(page.getByText(/pagada/i)).toBeVisible();
  });
});
