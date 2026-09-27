/**
 * "Volver a" seguro: solo rutas internas de detalle (proyecto o proveedor),
 * para que un enlace ?return_to=… nunca lleve a otro sitio.
 */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  const path = String(value);
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  if (!/^\/(projects|suppliers)\/[0-9a-f-]{36}(\?tab=[a-z-]+)?$/i.test(path)) return null;
  return path;
}

/** Texto del enlace "volver" según a dónde regresa. */
export function returnToLabel(path: string): string {
  return path.startsWith("/projects/") ? "Volver al proyecto" : "Volver al proveedor";
}

/** Agrega ?return_to=… (o &return_to=…) a un enlace interno. */
export function withReturnTo(href: string, returnTo: string | null | undefined): string {
  if (!returnTo) return href;
  return `${href}${href.includes("?") ? "&" : "?"}return_to=${encodeURIComponent(returnTo)}`;
}
