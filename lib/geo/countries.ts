/**
 * País, estado/provincia y ciudad de los clientes (migración 107). República Dominicana usa la provincia y el
 * municipio oficiales de la DGII (lib/dgii/catalogs); los demás países guardan el estado/provincia y la ciudad en
 * texto. Para los países más usados hay lista de estados o provincias; para el resto se escribe.
 */
import { placeName, provinceName } from "@/lib/dgii/catalogs";
import { COUNTRY_DATA } from "./countries-data";

export const HOME_COUNTRY = "DO";

export const COUNTRIES: { code: string; name: string }[] = COUNTRY_DATA.map(([code, name]) => ({ code, name }));

/** Salen primero en la lista de países. */
export const FAVORITE_COUNTRIES = ["DO", "US", "PR", "PA"] as const;

const byCode = new Map(COUNTRIES.map((c) => [c.code, c.name]));

export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  return byCode.get(code.toUpperCase()) ?? null;
}

export function isForeignCountry(code: string | null | undefined): boolean {
  return Boolean(code) && code!.toUpperCase() !== HOME_COUNTRY;
}

/** Minúsculas, sin acentos, sin puntos ni signos: «EE. UU.» = «ee uu». */
export function geoKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,()'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Otras formas de escribir un país (para la importación y el buscador). */
const COUNTRY_ALIASES: Record<string, string[]> = {
  DO: ["rd", "r d", "dominicana", "republica dominicana", "rep dominicana", "dominican republic", "do"],
  US: ["usa", "eeuu", "ee uu", "e u", "estados unidos de america", "united states", "us", "u s a"],
  PR: ["puerto rico", "pr"],
  PA: ["panama", "republica de panama"],
  MX: ["mexico"],
  GB: ["inglaterra", "uk", "gran bretana", "united kingdom"],
  ES: ["spain"],
  CA: ["canada"],
  NL: ["holanda", "netherlands"],
  KR: ["corea"],
  CI: ["cote d ivoire"],
  HK: ["hong kong"],
};

export type RegionEntry = { name: string; keywords?: string[] };

const plain = (names: string[]): RegionEntry[] => names.map((name) => ({ name }));

/** Estados de EE. UU.: nombre en español + abreviatura + nombre en inglés (para buscar e importar). */
const US_STATES: [string, string, string?][] = [
  ["Alabama", "AL"], ["Alaska", "AK"], ["Arizona", "AZ"], ["Arkansas", "AR"], ["California", "CA"],
  ["Carolina del Norte", "NC", "North Carolina"], ["Carolina del Sur", "SC", "South Carolina"], ["Colorado", "CO"],
  ["Connecticut", "CT"], ["Dakota del Norte", "ND", "North Dakota"], ["Dakota del Sur", "SD", "South Dakota"],
  ["Delaware", "DE"], ["Distrito de Columbia", "DC", "District of Columbia"], ["Florida", "FL"], ["Georgia", "GA"],
  ["Hawái", "HI", "Hawaii"], ["Idaho", "ID"], ["Illinois", "IL"], ["Indiana", "IN"], ["Iowa", "IA"], ["Kansas", "KS"],
  ["Kentucky", "KY"], ["Luisiana", "LA", "Louisiana"], ["Maine", "ME"], ["Maryland", "MD"], ["Massachusetts", "MA"],
  ["Míchigan", "MI", "Michigan"], ["Minnesota", "MN"], ["Misisipi", "MS", "Mississippi"], ["Misuri", "MO", "Missouri"],
  ["Montana", "MT"], ["Nebraska", "NE"], ["Nevada", "NV"], ["Nueva Jersey", "NJ", "New Jersey"],
  ["Nueva York", "NY", "New York"], ["Nuevo Hampshire", "NH", "New Hampshire"], ["Nuevo México", "NM", "New Mexico"],
  ["Ohio", "OH"], ["Oklahoma", "OK"], ["Oregón", "OR", "Oregon"], ["Pensilvania", "PA", "Pennsylvania"],
  ["Rhode Island", "RI"], ["Tennessee", "TN"], ["Texas", "TX"], ["Utah", "UT"], ["Vermont", "VT"], ["Virginia", "VA"],
  ["Virginia Occidental", "WV", "West Virginia"], ["Washington", "WA"], ["Wisconsin", "WI"], ["Wyoming", "WY"],
];

const REGIONS: Record<string, { label: string; entries: RegionEntry[] }> = {
  US: { label: "Estado", entries: US_STATES.map(([name, abbr, en]) => ({ name, keywords: [abbr, ...(en ? [en] : [])] })) },
  PR: {
    label: "Municipio",
    entries: plain([
      "Adjuntas", "Aguada", "Aguadilla", "Aguas Buenas", "Aibonito", "Añasco", "Arecibo", "Arroyo", "Barceloneta",
      "Barranquitas", "Bayamón", "Cabo Rojo", "Caguas", "Camuy", "Canóvanas", "Carolina", "Cataño", "Cayey", "Ceiba",
      "Ciales", "Cidra", "Coamo", "Comerío", "Corozal", "Culebra", "Dorado", "Fajardo", "Florida", "Guánica", "Guayama",
      "Guayanilla", "Guaynabo", "Gurabo", "Hatillo", "Hormigueros", "Humacao", "Isabela", "Jayuya", "Juana Díaz",
      "Juncos", "Lajas", "Lares", "Las Marías", "Las Piedras", "Loíza", "Luquillo", "Manatí", "Maricao", "Maunabo",
      "Mayagüez", "Moca", "Morovis", "Naguabo", "Naranjito", "Orocovis", "Patillas", "Peñuelas", "Ponce",
      "Quebradillas", "Rincón", "Río Grande", "Sabana Grande", "Salinas", "San Germán", "San Juan", "San Lorenzo",
      "San Sebastián", "Santa Isabel", "Toa Alta", "Toa Baja", "Trujillo Alto", "Utuado", "Vega Alta", "Vega Baja",
      "Vieques", "Villalba", "Yabucoa", "Yauco",
    ]),
  },
  PA: {
    label: "Provincia o comarca",
    entries: plain([
      "Bocas del Toro", "Chiriquí", "Coclé", "Colón", "Darién", "Herrera", "Los Santos", "Panamá", "Panamá Oeste",
      "Veraguas", "Comarca Emberá-Wounaan", "Comarca Guna de Madugandí", "Comarca Guna de Wargandí", "Comarca Guna Yala",
      "Comarca Naso Tjër Di", "Comarca Ngäbe-Buglé",
    ]),
  },
  MX: {
    label: "Estado",
    entries: plain([
      "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua", "Ciudad de México",
      "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "Michoacán",
      "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa",
      "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
    ]),
  },
  CO: {
    label: "Departamento",
    entries: plain([
      "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá D. C.", "Bolívar", "Boyacá", "Caldas", "Caquetá", "Casanare",
      "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena",
      "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío", "Risaralda", "San Andrés y Providencia", "Santander",
      "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada",
    ]),
  },
  ES: {
    label: "Comunidad autónoma",
    entries: plain([
      "Andalucía", "Aragón", "Asturias", "Canarias", "Cantabria", "Castilla y León", "Castilla-La Mancha", "Cataluña",
      "Ceuta", "Comunidad de Madrid", "Comunidad Valenciana", "Extremadura", "Galicia", "Islas Baleares", "La Rioja",
      "Melilla", "Murcia", "Navarra", "País Vasco",
    ]),
  },
  CA: {
    label: "Provincia o territorio",
    entries: plain([
      "Alberta", "Columbia Británica", "Isla del Príncipe Eduardo", "Manitoba", "Nueva Escocia", "Nuevo Brunswick",
      "Nunavut", "Ontario", "Quebec", "Saskatchewan", "Terranova y Labrador", "Territorios del Noroeste", "Yukón",
    ]),
  },
};

/** Lista de estados/provincias del país, o null si se escribe a mano. */
export function regionsOf(code: string | null | undefined): RegionEntry[] | null {
  return (code && REGIONS[code.toUpperCase()]?.entries) || null;
}

/** Cómo se llama la división del país («Estado», «Provincia o comarca», «Municipio»…). */
export function regionLabel(code: string | null | undefined): string {
  return (code && REGIONS[code.toUpperCase()]?.label) || "Estado / provincia";
}

/** Reconoce un país escrito a mano (nombre, código o forma común). */
export function matchCountry(text: string): string | null {
  const k = geoKey(text);
  if (!k) return null;
  const upper = text.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(upper) && byCode.has(upper)) return upper;
  for (const c of COUNTRIES) if (geoKey(c.name) === k) return c.code;
  for (const [code, aliases] of Object.entries(COUNTRY_ALIASES)) if (aliases.includes(k)) return code;
  return null;
}

/** Reconoce un estado/provincia de la lista del país (por nombre, abreviatura o nombre en inglés). */
export function matchRegion(countryCode: string, text: string): string | null {
  const list = regionsOf(countryCode);
  const k = geoKey(text);
  if (!list || !k) return null;
  for (const r of list) if (geoKey(r.name) === k || (r.keywords ?? []).some((w) => geoKey(w) === k)) return r.name;
  return null;
}

export type ClientPlace = {
  country_code?: string | null;
  region?: string | null;
  city?: string | null;
  province_code?: string | null;
  municipality_code?: string | null;
};

/**
 * Ubicación en una línea. RD: «Santo Domingo Este, Santo Domingo» (sin el país). Otro país: «Miramar, Florida,
 * Estados Unidos». Vacío si no hay datos.
 */
export function formatClientLocation(p: ClientPlace): string {
  if (isForeignCountry(p.country_code)) {
    return [p.city, p.region, countryName(p.country_code) ?? p.country_code].filter(Boolean).join(", ");
  }
  return [placeName(p.municipality_code ?? null), provinceName(p.province_code ?? null)].filter(Boolean).join(", ");
}
