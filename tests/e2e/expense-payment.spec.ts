import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Gastos y pagos a proveedores", () => {
  test("crear proveedor, crear gasto asociado y pagarlo por completo", async ({ page }) => {
    await login(page);

    const supplierName = `Proveedor E2E ${Date.now()}`;
    await page.goto("/suppliers/new");
    await page.locator('input[name="name"]').fill(supplierName);
    await page.getByRole("button", { name: /guardar proveedor/i }).click();
    await expect(page.getByRole("heading", { name: supplierName })).toBeVisible();

    await page.goto("/expenses/new");
    await page.locator('input[name="description"]').fill("Gasto E2E con proveedor");
    await page.locator('select[name="supplier_id"]').selectOption({ label: supplierName });
    // MoneyInput: el input visible no tiene "name" (eso está en un input
    // oculto sincronizado) — se ubica por su label en su lugar.
    await page.getByLabel(/subtotal/i).fill("1000");
    await page.getByRole("button", { name: /crear gasto/i }).click();

    await expect(page.getByText(/pendiente/i)).toBeVisible();

    // El monto ya viene precargado con el balance completo — solo enviar
    await page.getByRole("button", { name: /registrar pago/i }).click();
    await expect(page.getByText(/pagado/i)).toBeVisible();
  });
});
