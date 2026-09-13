import { Page, expect } from "@playwright/test";

/**
 * Las credenciales NUNCA se hardcodean aquí (el repo es público) — se leen
 * de variables de entorno que cada quien configura localmente (ver
 * .env.test.example). Si no están configuradas, el test se salta con un
 * mensaje claro en vez de fallar de forma confusa.
 */
export function getTestCredentials() {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Faltan E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD en el entorno. " +
        "Copia .env.test.example a .env.test y complétalo con un usuario de prueba.",
    );
  }
  return { email, password };
}

export async function login(page: Page) {
  const { email, password } = getTestCredentials();
  await page.goto("/login");
  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel(/contraseña/i).fill(password);
  await page.getByRole("button", { name: /^ingresar$/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
