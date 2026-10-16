"use client";

import { useEffect } from "react";

/**
 * Guarda una preferencia de pantalla en una cookie (1 año) para que al
 * volver a la pantalla se respete, ej. la vista Lista/Tarjetas de Bancos.
 * Solo preferencias visuales: nunca datos.
 */
export function RememberChoice({ name, value }: { name: string; value: string | null }) {
  useEffect(() => {
    if (value === null) return;
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
  }, [name, value]);
  return null;
}
