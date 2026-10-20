/**
 * Datos del sistema que se muestran en el pie de página, en la ventana de
 * Política / Términos y en Configuración → Sistema.
 *
 * VERSIÓN: debe ser igual a "version" de package.json (lo revisa la prueba
 * tests/unit/app-info.test.ts). Al publicar un cambio importante: subir la
 * versión en los dos lugares, cambiar RELEASE_DATE y anotarlo en CHANGELOG.md.
 *  - 1.0.0 → 1.0.1  corrección pequeña
 *  - 1.0.0 → 1.1.0  función nueva
 *  - 1.0.0 → 2.0.0  cambio grande
 */
export const APP_NAME = "Mindfreak Manager";
export const APP_VERSION = "1.0.0";
/** Fecha de la última actualización publicada (AAAA-MM-DD). */
export const RELEASE_DATE = "2026-10-19";

export const COMPANY_NAME = "Mindfreak Events";
export const COMPANY_RNC = "133223414";
export const COMPANY_PHONE = "809-890-9206";
export const SUPPORT_EMAIL = "info@mindfreakevents.com";

export function copyrightText(year = new Date().getFullYear()): string {
  return `${COMPANY_NAME} © ${year}. Todos los derechos reservados.`;
}

export function environmentLabel(): string {
  return process.env.NODE_ENV === "production" ? "Producción" : "Desarrollo";
}
