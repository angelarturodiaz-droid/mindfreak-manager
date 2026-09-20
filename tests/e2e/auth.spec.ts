import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Autenticación", () => {
  test("un usuario válido puede iniciar sesión y ver el dashboard", async ({ page }) => {
    await login(page);
    await expect(page.getByText(/dashboard/i).first()).toBeVisible();
  });

  test("cerrar sesión regresa a /login", async ({ page }) => {
    await login(page);
    // El botón "Cerrar sesión" vive dentro del menú de cuenta (dropdown).
    await page.getByRole("button", { name: /cuenta/i }).click();
    await page.getByRole("button", { name: /cerrar sesión/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("credenciales inválidas muestran un error y no entran", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("no-existe@mindfreakevents.com");
    await page.locator('input[name="password"]').fill("contraseña-incorrecta-123");
    await page.getByRole("button", { name: /^ingresar$/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/correo o contraseña incorrectos/i)).toBeVisible();
  });
});
