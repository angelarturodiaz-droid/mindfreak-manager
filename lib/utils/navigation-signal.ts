/**
 * Cuando un Server Action termina con redirect() (ej. "Descartar borrador"
 * lleva a la lista de facturas), Next.js lo comunica lanzando una "señal"
 * interna (NEXT_REDIRECT / NEXT_NOT_FOUND). No es un error: la acción salió
 * bien y la navegación ya ocurrió. Los botones que muestran toasts de error
 * deben ignorarla para no mostrar "NEXT_REDIRECT" al usuario.
 */
export function isNavigationSignal(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  const message = err instanceof Error ? err.message : "";
  return (
    (typeof digest === "string" &&
      (digest.startsWith("NEXT_REDIRECT") ||
        digest === "NEXT_NOT_FOUND" ||
        digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))) ||
    message === "NEXT_REDIRECT" ||
    message === "NEXT_NOT_FOUND"
  );
}
