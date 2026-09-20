import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Cotización → Proyecto", () => {
  test("crear cotización, aprobarla y convertirla en proyecto", async ({ page }) => {
    await login(page);

    await page.goto("/quotations/new");
    await page.locator('select[name="client_id"]').selectOption({ index: 1 });
    await page.getByRole("button", { name: /crear cotización/i }).click();
    await expect(page.getByText("Borrador", { exact: true })).toBeVisible();

    // Necesita al menos una línea para poder enviarla/aprobarla con sentido
    await page.locator('input[name="description"]').fill("Línea E2E flujo completo");
    await page.locator('input[name="quantity"]').fill("1");
    // MoneyInput: el input visible no tiene "name" (eso está en un input
    // oculto sincronizado) — se ubica por su label en su lugar.
    await page.getByLabel(/precio/i).fill("1000");
    await page.getByRole("button", { name: /agregar línea/i }).click();
    await expect(page.getByText("Línea E2E flujo completo")).toBeVisible();

    await page.getByRole("button", { name: /marcar como enviada/i }).click();
    await expect(page.getByText(/enviada/i)).toBeVisible();

    await page.getByRole("button", { name: /^aprobar$/i }).click();
    await expect(page.getByText(/aprobada/i)).toBeVisible();

    await page.getByRole("link", { name: /convertir a proyecto/i }).click();
    await expect(page).toHaveURL(/\/projects\/from-quotation\//);

    // La página de conversión ya trae los datos precargados; solo confirmar
    await page.getByRole("button", { name: /convertir en proyecto/i }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
  });
});
