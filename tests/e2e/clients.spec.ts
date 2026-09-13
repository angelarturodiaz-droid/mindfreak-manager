import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Clientes", () => {
  test("crear un cliente nuevo y verlo en la lista", async ({ page }) => {
    await login(page);

    await page.goto("/clients/new");
    const uniqueName = `Cliente E2E ${Date.now()}`;
    await page.locator('input[name="name"]').fill(uniqueName);
    await page.locator('input[name="email"]').fill("cliente-e2e@example.com");
    await page.getByRole("button", { name: /guardar cliente/i }).click();

    // Tras crear, la app redirige al detalle del cliente
    await expect(page.getByRole("heading", { name: uniqueName })).toBeVisible();

    // Y también debe aparecer en el listado
    await page.goto("/clients");
    await expect(page.getByText(uniqueName)).toBeVisible();
  });
});
