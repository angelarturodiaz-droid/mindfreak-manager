import path from "path";
import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Documentos", () => {
  test("subir un documento a un cliente y verlo en la lista", async ({ page }) => {
    await login(page);

    const uniqueName = `Cliente Docs E2E ${Date.now()}`;
    await page.goto("/clients/new");
    await page.locator('input[name="name"]').fill(uniqueName);
    await page.getByRole("button", { name: /guardar cliente/i }).click();
    await expect(page.getByRole("heading", { name: uniqueName })).toBeVisible();

    // Sube un archivo de prueba pequeño ya incluido en el repo (este mismo
    // archivo de test sirve como archivo de prueba, cualquiera sirve).
    await page.locator('input[name="file"]').setInputFiles(path.join(__dirname, "helpers.ts"));
    await page.getByRole("button", { name: /^subir$/i }).click();

    await expect(page.getByText("helpers.ts")).toBeVisible();

    // Debe poder eliminarse después
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /^eliminar$/i }).click();
    await expect(page.getByText("helpers.ts")).not.toBeVisible();
  });
});
