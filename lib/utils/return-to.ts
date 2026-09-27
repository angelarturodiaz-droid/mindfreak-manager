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
