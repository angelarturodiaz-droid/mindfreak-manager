/**
 * Listas oficiales del formato e-CF de la DGII (Formato Comprobante Fiscal Electrónico v1.0) y los textos de
 * ayuda del «Manual de facturación electrónica DGII — Mindfreak Events» (23-oct-2026). Solo datos: no calcula impuestos.
 */
import { MUNICIPIOS_RAW, PROVINCIAS_RAW } from "./municipios-data";

export type Option = { value: string; label: string; info?: string };

/** 1 · Tipo de e-CF (lo que se elige en el Facturador). */
export const ECF_TYPES: Option[] = [
  { value: "31", label: "31 · Crédito fiscal", info: "El cliente necesita sustentar crédito fiscal (empresas con RNC). Es el de casi todas las ventas de Mindfreak." },
  { value: "32", label: "32 · Consumo", info: "Consumidor final: el cliente no necesita crédito fiscal (personas sin RNC)." },
  { value: "33", label: "33 · Nota de débito", info: "Para aumentar el monto de un e-CF ya emitido." },
  { value: "34", label: "34 · Nota de crédito", info: "Para anular o rebajar un e-CF ya emitido." },
  { value: "44", label: "44 · Regímenes especiales", info: "Clientes en regímenes especiales (zonas francas, etc.)." },
  { value: "45", label: "45 · Gubernamental", info: "Ventas al Gobierno (ministerios, ayuntamientos, instituciones públicas)." },
  { value: "46", label: "46 · Exportaciones", info: "Ventas a clientes del exterior que califican como exportación." },
];

/** Tipo de comprobante tradicional (NCF), para las facturas que no son electrónicas. */
export const NCF_TYPES: Option[] = [
  { value: "B01", label: "B01 · Crédito fiscal" },
  { value: "B02", label: "B02 · Consumo" },
  { value: "B14", label: "B14 · Regímenes especiales" },
  { value: "B15", label: "B15 · Gubernamental" },
  { value: "B16", label: "B16 · Exportaciones" },
];

/** 4 · Tipo de ingreso (Norma 07-18). */
export const INCOME_TYPES: Option[] = [
  { value: "01", label: "01 · Ingresos por operaciones (no financieros)", info: "Lo normal de Mindfreak: producción, coordinación, montaje y servicios de eventos." },
  { value: "02", label: "02 · Ingresos financieros", info: "Intereses y rendimientos financieros." },
  { value: "03", label: "03 · Ingresos extraordinarios", info: "Fuera de lo habitual: revísalo con contabilidad antes de usarlo." },
  { value: "04", label: "04 · Ingresos por arrendamientos", info: "Alquiler de equipos facturado por separado." },
  { value: "05", label: "05 · Venta de activo depreciable", info: "Venta de un activo de la empresa (ej. un equipo usado)." },
  { value: "06", label: "06 · Otros ingresos", info: "No usarlo por defecto." },
];

/** 3 · Tipo de pago. */
export const PAYMENT_TYPES: Option[] = [
  { value: "1", label: "1 · Contado", info: "Se paga al momento." },
  { value: "2", label: "2 · Crédito", info: "Queda pendiente según el plazo (ej. 30 días). «Crédito» es la condición; transferencia o efectivo es el medio." },
  { value: "3", label: "3 · Gratuito", info: "Entrega sin pago. No es para anticipos ni pagos pendientes, y no vale para crédito fiscal." },
];

/** 17 · Bien o servicio. */
export const ITEM_KINDS: Option[] = [
  { value: "SERVICIO", label: "Servicio", info: "Producción de eventos, coordinación, montaje, alquileres, honorarios." },
  { value: "BIEN", label: "Bien", info: "Un artículo que se vende y se entrega (ej. un producto)." },
];

/** 16 · Unidad de medida (Tabla IV del formato e-CF). Las más usadas por Mindfreak primero. */
const UNITS_RAW: [string, string][] = [
  ["1", "Barril"], ["2", "Bolsa"], ["3", "Bote"], ["4", "Bultos"], ["5", "Botella"], ["6", "Caja/Cajón"], ["7", "Cajetilla"],
  ["8", "Centímetro"], ["9", "Cilindro"], ["10", "Conjunto"], ["11", "Contenedor"], ["12", "Día"], ["13", "Docena"], ["14", "Fardo"],
  ["15", "Galones"], ["16", "Grado"], ["17", "Gramo"], ["18", "Granel"], ["19", "Hora"], ["20", "Huacal"], ["21", "Kilogramo"],
  ["22", "Kilovatio hora"], ["23", "Libra"], ["24", "Litro"], ["25", "Lote"], ["26", "Metro"], ["27", "Metro cuadrado"],
  ["28", "Metro cúbico"], ["29", "Millones de unidades térmicas"], ["30", "Minuto"], ["31", "Paquete"], ["32", "Par"], ["33", "Pie"],
  ["34", "Pieza"], ["35", "Rollo"], ["36", "Sobre"], ["37", "Segundo"], ["38", "Tanque"], ["39", "Tonelada"], ["40", "Tubo"],
  ["41", "Yarda"], ["42", "Yarda cuadrada"], ["43", "Unidad"], ["44", "Elemento"], ["45", "Millar"], ["46", "Saco"], ["47", "Lata"],
  ["48", "Display"], ["49", "Bidón"], ["50", "Ración"], ["51", "Quintal"], ["52", "Toneladas de registro bruto"], ["53", "Pie cuadrado"],
  ["54", "Pasajero"], ["55", "Pulgadas"], ["56", "Parque o barcos en muelle"], ["57", "Bandeja"], ["58", "Hectárea"], ["59", "Mililitro"],
  ["60", "Miligramo"], ["61", "Onzas"], ["62", "Onzas Troy"],
];
export const COMMON_UNIT_CODES = ["43", "19", "12", "10", "50", "34", "27", "31", "25"];
export const DEFAULT_UNIT_CODE = "43";
// En pantalla se elige por nombre; el número oficial (código DGII) va por dentro (value) y es el que se envía en el e-CF.
export const UNITS: Option[] = UNITS_RAW.map(([value, label]) => ({ value, label }));
export const UNITS_COMMON: Option[] = COMMON_UNIT_CODES.map((c) => UNITS.find((u) => u.value === c)!);
export const UNITS_OTHER: Option[] = UNITS.filter((u) => !COMMON_UNIT_CODES.includes(u.value)).sort((a, b) => a.label.localeCompare(b.label, "es"));

export function unitName(code: string | null | undefined): string {
  const row = UNITS_RAW.find(([c]) => c === (code ?? DEFAULT_UNIT_CODE));
  return row ? row[1] : "Unidad";
}

// ---------------------------------------------------------------------------------------------
// Provincias y municipios (código e-CF de 6 dígitos)
// ---------------------------------------------------------------------------------------------
const SMALL = new Set(["de", "del", "la", "las", "los", "el", "y", "al"]);

/** «SAN FRANCISCO DE MACORÍS» → «San Francisco de Macorís». */
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((w, i, all) => (i > 0 && SMALL.has(w) && all[i - 1] !== "-" ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("")
    .replace(/\(([a-záéíóúñ])/g, (_, c: string) => `(${c.toUpperCase()}`);
}

export type Place = { code: string; name: string; kind: "municipio" | "distrito"; municipioCode: string };

export const PROVINCES: Option[] = PROVINCIAS_RAW.split("\n").map((line) => {
  const [code, name] = line.split("|");
  return { value: code, label: titleCase(name) };
});

const PLACES: Place[] = MUNICIPIOS_RAW.split("\n").map((line) => {
  const [code, raw] = line.split("|");
  const isMunicipio = raw.startsWith("MUNICIPIO ");
  const clean = raw.replace(/^MUNICIPIO /, "").replace(/\s*\(D\.\s?M\.\)\.?/g, "").trim();
  return {
    code,
    name: titleCase(clean),
    kind: isMunicipio ? "municipio" : "distrito",
    municipioCode: code.slice(0, 4) + "00",
  };
});

/** Municipios y distritos municipales de una provincia, agrupados por municipio. */
export function placesOfProvince(provinceCode: string | null | undefined): { municipio: Place; distritos: Place[] }[] {
  if (!provinceCode) return [];
  const prefix = provinceCode.slice(0, 2);
  const rows = PLACES.filter((p) => p.code.startsWith(prefix));
  const municipios = rows.filter((p) => p.kind === "municipio");
  return municipios.map((m) => ({
    municipio: m,
    distritos: rows.filter((p) => p.kind === "distrito" && p.code.slice(0, 4) === m.code.slice(0, 4) && p.name !== m.name),
  }));
}

export function provinceName(code: string | null | undefined): string | null {
  return PROVINCES.find((p) => p.value === code)?.label ?? null;
}

export function placeName(code: string | null | undefined): string | null {
  const p = PLACES.find((x) => x.code === code);
  if (!p) return null;
  return p.kind === "distrito" ? `${p.name} (distrito municipal)` : p.name;
}

/** ¿El municipio es de esa provincia? */
export function placeInProvince(placeCode: string | null | undefined, provinceCode: string | null | undefined): boolean {
  if (!placeCode || !provinceCode) return true;
  return placeCode.slice(0, 2) === provinceCode.slice(0, 2);
}

/** Textos de ayuda (ⓘ) de cada campo de la factura electrónica. */
export const ECF_FIELD_INFO = {
  ecfType: "Qué tipo de comprobante es. 31 Crédito fiscal: el cliente es una empresa que lo necesita para su crédito fiscal. 32 Consumo: consumidor final. Los demás tienen usos específicos. Nunca uses el 41 para facturar una venta.",
  issueDate: "La fecha en que se emite. La fecha del evento puede ir en la descripción. No muevas fechas para cambiar el mes del ingreso.",
  paymentType: "Contado: se paga al momento. Crédito: queda pendiente según el plazo. Gratuito: entrega sin pago (no para anticipos ni pagos pendientes).",
  incomeType: "Casi siempre 01 (operaciones): producción, coordinación y montaje de eventos. Una sola categoría por e-CF.",
  comments: "Una referencia útil para el cliente y para ustedes, ej. «PROY-0026 · Evento corporativo · OC aprobada». No reemplaza las líneas.",
  foreignId: "Solo para clientes del exterior que no tienen RNC dominicano (ej. su número fiscal o pasaporte).",
  province: "La provincia de la dirección del cliente. Se usa en la factura electrónica y en los reportes por zona. La sede del evento puede ir en la descripción de la factura.",
  municipality: "El municipio o distrito municipal de la dirección del cliente. Debe ser de la provincia elegida.",
  unit: "La unidad que coincide con el precio: un evento completo = Unidad; por hora = Hora; por día = Día; un paquete de servicios = Conjunto; comida por persona = Ración.",
  itemKind: "Producción de eventos y servicios = Servicio. Un artículo vendido = Bien. Se toma del catálogo de Productos y Servicios.",
  discount: "En el Facturador el descuento va en MONTO (RD$), no en %. Ej. 5 % de 100,000 = 5,000.",
  zeroVsExempt: "0 % y Exento NO son lo mismo: no los cambies para cuadrar un total.",
  retentions: "En una venta tipo 31 el Facturador bloquea ITBIS e ISR retenidos (solo aplican a 41 y 47). Las retenciones que te hace el cliente se registran al cobrar.",
  tip: "No actives la propina legal: es para consumo de comidas y bebidas en el establecimiento, no para eventos.",
  rounding: "Deja apagado «Redondear monto total» salvo que contabilidad confirme su efecto.",
} as const;
