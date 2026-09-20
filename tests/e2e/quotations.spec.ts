import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Cotizaciones", () => {
  test("crear una cotización y agregarle una línea", async ({ page }) => {
    await login(page);

    await page.goto("/quotations/new");
    // Usa el primer cliente disponible en el select (requiere al menos un
    // cliente ya creado — ver tests/clients.spec.ts o datos reales).
    const clientSelect = page.locator('select[name="client_id"]');
    await clientSelect.selectOption({ index: 1 });
    await page.getByRole("button", { name: /crear cotización/i }).click();

    // Redirige al detalle de la cotización recién creada (estado DRAFT)
    // Redirige al detalle de la cotización recién creada (estado DRAFT).
    // exact: true evita coincidir también con el botón "Descartar borrador".
    await expect(page.getByText("Borrador", { exact: true })).toBeVisible();

    // Agrega una línea personalizada (sin servicio del catálogo)
    await page.locator('input[name="description"]').fill("Línea de prueba E2E");
    await page.locator('input[name="quantity"]').fill("2");
    // MoneyInput: el input visible no tiene "name" (eso está en un input
    // oculto sincronizado) — se ubica por su label en su lugar.
    await page.getByLabel(/precio/i).fill("500");
    await page.getByRole("button", { name: /agregar línea/i }).click();

    await expect(page.getByText("Línea de prueba E2E")).toBeVisible();
    // 2 × 500 = 1000 de subtotal antes de impuesto
    await expect(page.getByText(/RD\$1,000\.00|1,000\.00/)).toBeVisible();
  });
});
