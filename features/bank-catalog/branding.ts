/**
 * Identidad visual de los bancos (migración 084): color de la tarjeta y
 * logo. Se guarda una vez por banco en el catálogo (bank_catalog) y la usan
 * todas las cuentas de ese banco, enlazadas por el nombre del banco.
 * Si el usuario no subió logo, se usa el que trae el sistema para los bancos
 * conocidos (public/bank-logos) y, si no hay, las iniciales en su color.
 */

export type BankBrand = {
  name: string;
  /** #rrggbb o null (sin color: estilo neutro). */
  color: string | null;
  /** URL o data URL del logo, o null. */
  logo: string | null;
  initials: string;
};

/** Logos e iniciales de los bancos conocidos (los logos los entregó la empresa). */
const KNOWN: Record<string, { initials: string; logo?: string; color?: string }> = {
  Banreservas: { initials: "BR", logo: "/bank-logos/banreservas.webp", color: "#00558c" },
  "Banco Popular Dominicano": { initials: "BP", logo: "/bank-logos/popular.webp", color: "#12336f" },
  "Banco BHD": { initials: "BHD", logo: "/bank-logos/bhd.webp", color: "#1f8a3a" },
  "Banco Promerica": { initials: "PR", logo: "/bank-logos/promerica.webp", color: "#0f6a37" },
  "Banco Santa Cruz": { initials: "SC" },
  "Banco Caribe": { initials: "BC" },
  "Banco Lafise": { initials: "LF" },
  "Banco Vimenca": { initials: "VI" },
  Scotiabank: { initials: "SB" },
  "Asociación Popular de Ahorros y Préstamos (APAP)": { initials: "AP" },
  "Asociación Cibao de Ahorros y Préstamos": { initials: "AC" },
};

const STOP = new Set(["banco", "de", "del", "la", "las", "los", "y", "dominicano", "dominicana", "s.a.", "sa"]);

/** Iniciales para el cuadrito cuando no hay logo (máx. 3 letras). */
export function bankInitials(name: string | null | undefined): string {
  if (!name) return "";
  const known = KNOWN[name];
  if (known) return known.initials;
  const clean = name.replace(/\(.*?\)/g, " ").trim();
  const words = clean.split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase()));
  const src = words.length > 0 ? words : clean.split(/\s+/);
  if (src.length === 1) return src[0].slice(0, 2).toUpperCase();
  return src
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Colores para elegir rápido en el editor (además de "Otro color…"). */
export const BRAND_SWATCHES = ["#00558c", "#12336f", "#1f8a3a", "#0f6a37", "#c8102e", "#e35205", "#6b2fa0", "#334155"];

/** Blanco o casi negro según qué se lee mejor sobre el color. */
export function readableTextOn(hex: string): "#ffffff" | "#111827" {
  if (!HEX_COLOR.test(hex)) return "#ffffff";
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45 ? "#111827" : "#ffffff";
}

/** Marca de un banco: lo guardado en el catálogo y, si falta, lo del sistema. */
export function resolveBankBrand(
  bankName: string | null | undefined,
  row?: { brand_color: string | null; logo_data: string | null } | null,
): BankBrand | null {
  if (!bankName || bankName === "Otro") return null;
  const known = KNOWN[bankName];
  return {
    name: bankName,
    color: row?.brand_color ?? known?.color ?? null,
    logo: row?.logo_data ?? known?.logo ?? null,
    initials: bankInitials(bankName),
  };
}

/** Logo que trae el sistema para un banco (para "Volver al logo del sistema"). */
export function defaultBankLogo(bankName: string): string | null {
  return KNOWN[bankName]?.logo ?? null;
}
