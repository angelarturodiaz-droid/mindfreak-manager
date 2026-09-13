import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Carga .env.test para que E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD lleguen a
// process.env — Playwright NO lee archivos .env por sí solo.
config({ path: ".env.test" });

/**
 * Tests E2E — requieren `npm run dev` corriendo en localhost:3000 y una
 * sesión real contra Supabase. No se ejecutan en el entorno de build de
 * Claude (sin navegador ni red hacia Supabase) — correr localmente con
 * `npx playwright test` (después de `npx playwright install` una vez).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
