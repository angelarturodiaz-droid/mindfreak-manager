/**
 * A4 — Carga masiva de clientes con Excel: columnas de la plantilla y revisión fila por fila (dos contactos por fila:
 * el principal y el de cobros). Funciones puras: las usan la pantalla (vista previa) y el servidor (que vuelve a
 * revisar todo antes de guardar).
 */
import { normalizeCatalogName } from "@/features/supplier-service-types/classification";
import { PROVINCES, placesOfProvince } from "@/lib/dgii/catalogs";
import { CLIENT_STAGE_LABELS } from "./display";

export type ClientImportKey =
  | "name"
  | "tax_id"
  | "foreign_id"
  | "stage"
  | "email"
  | "phone"
  | "address"
  | "province"
  | "municipality"
  | "c1_name"
  | "c1_position"
  | "c1_email"
  | "c1_phone"
  | "c1_billing"
  | "c2_name"
  | "c2_position"
  | "c2_email"
  | "c2_phone";

export type ClientImportColumn = { key: ClientImportKey; header: string; help: string; width: number; text?: boolean; required?: boolean };

export const CLIENT_IMPORT_COLUMNS: ClientImportColumn[] = [
  { key: "name", header: "Nombre", help: "Obligatorio. Razón social o nombre de la persona.", width: 34, required: true },
  { key: "tax_id", header: "RNC o cédula", help: "RNC: 9 dígitos. Cédula: 11 dígitos. Con o sin guiones. Sin él no se le puede emitir factura con crédito fiscal.", width: 18, text: true },
  { key: "foreign_id", header: "ID extranjero", help: "Pasaporte o ID fiscal, solo si el cliente es del extranjero.", width: 18, text: true },
  { key: "stage", header: "Etapa", help: "Cliente, Prospecto o Lead. Vacío = Cliente.", width: 14 },
  { key: "email", header: "Correo", help: "Correo del negocio.", width: 28 },
  { key: "phone", header: "Teléfono", help: "Teléfono del negocio.", width: 16, text: true },
  { key: "address", header: "Dirección", help: "Dirección del negocio.", width: 34 },
  { key: "province", header: "Provincia", help: "Provincia (lista oficial de la DGII). Se usa en la factura electrónica.", width: 24 },
  { key: "municipality", header: "Municipio", help: "Municipio o distrito municipal de esa provincia (hoja Listas).", width: 26 },
  { key: "c1_name", header: "Contacto principal: nombre", help: "Persona con quien se trata (opcional).", width: 26 },
  { key: "c1_position", header: "Contacto principal: cargo", help: "Cargo del contacto principal.", width: 22 },
  { key: "c1_email", header: "Contacto principal: correo", help: "Correo del contacto principal.", width: 28 },
  { key: "c1_phone", header: "Contacto principal: teléfono", help: "Teléfono del contacto principal.", width: 20, text: true },
  { key: "c1_billing", header: "¿Recibe recordatorios de cobro?", help: "Sí o No. Vacío = Sí si el contacto principal tiene correo.", width: 18 },
  { key: "c2_name", header: "Contacto de cobros: nombre", help: "Opcional: la persona de cuentas por pagar del cliente. Siempre recibe los recordatorios de cobro.", width: 26 },
  { key: "c2_position", header: "Contacto de cobros: cargo", help: "Cargo del contacto de cobros.", width: 22 },
  { key: "c2_email", header: "Contacto de cobros: correo", help: "Correo donde llegan los recordatorios de cobro.", width: 28 },
  { key: "c2_phone", header: "Contacto de cobros: teléfono", help: "Teléfono del contacto de cobros.", width: 20, text: true },
];

export const CLIENT_IMPORT_SHEET = "Clientes";
export const CLIENT_IMPORT_MAX_ROWS = 2000;

export type ClientImportCatalogs = {
  /** RNC/cédulas (solo dígitos) de clientes que ya existen. */
  existingTaxIds: string[];
  existingNames: string[];
};

type Contact = { full_name: string; position: string | null; email: string | null; phone: string | null; is_primary: boolean; receives_billing: boolean };

export type ClientImportRecord = {
  name: string;
  tax_id: string | null;
  foreign_id: string | null;
  stage: "LEAD" | "PROSPECT" | "CLIENT";
  email: string | null;
  phone: string | null;
  address: string | null;
  province_code: string | null;
  municipality_code: string | null;
  contacts: Contact[];
};

export type ClientImportRow = {
  row: number;
  name: string;
  status: "ok" | "warn" | "error";
  messages: { level: "error" | "warn"; text: string }[];
  record: ClientImportRecord | null;
  raw: string[];
};

const norm = (s: string) => normalizeCatalogName(s ?? "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Municipios y distritos de una provincia, por nombre normalizado. */
function placesByName(provinceCode: string) {
  const map = new Map<string, string>();
  for (const g of placesOfProvince(provinceCode)) {
    map.set(norm(g.municipio.name), g.municipio.code);
    for (const d of g.distritos) if (!map.has(norm(d.name))) map.set(norm(d.name), d.code);
  }
  return map;
}

export function mapClientHeader(header: string[]) {
  const index: Partial<Record<ClientImportKey, number>> = {};
  header.forEach((h, i) => {
    const col = CLIENT_IMPORT_COLUMNS.find((c) => norm(c.header) === norm(h));
    if (col && index[col.key] == null) index[col.key] = i;
  });
  const missing = CLIENT_IMPORT_COLUMNS.filter((c) => c.required && index[c.key] == null).map((c) => c.header);
  return { index, missing };
}

export function validateClientRows(rows: string[][], catalogs: ClientImportCatalogs): { error: string | null; results: ClientImportRow[] } {
  if (rows.length === 0) return { error: "El archivo está vacío.", results: [] };
  const { index, missing } = mapClientHeader(rows[0]);
  if (missing.length) {
    return {
      error: `No se encontró la columna «${missing.join("», «")}». Usa la plantilla descargada desde esta pantalla (hoja «${CLIENT_IMPORT_SHEET}»).`,
      results: [],
    };
  }
  const data = rows.slice(1);
  if (data.filter((r) => r.some((c) => c && c.trim())).length > CLIENT_IMPORT_MAX_ROWS) {
    return { error: `El archivo tiene más de ${CLIENT_IMPORT_MAX_ROWS} filas. Divídelo en partes.`, results: [] };
  }
  const existingIds = new Set(catalogs.existingTaxIds);
  const existingNames = new Set(catalogs.existingNames.map(norm));
  const provinceByName = new Map<string, string>();
  for (const p of PROVINCES) {
    provinceByName.set(norm(p.label), p.value);
    provinceByName.set(p.value, p.value);
  }
  const seenIds = new Map<string, number>();
  const seenNames = new Map<string, number>();
  const results: ClientImportRow[] = [];

  data.forEach((raw, i) => {
    if (!raw.some((c) => c && c.trim())) return;
    const rowNo = i + 2;
    const get = (k: ClientImportKey) => (index[k] != null ? String(raw[index[k]!] ?? "").trim() : "");
    const msgs: ClientImportRow["messages"] = [];
    const err = (t: string) => msgs.push({ level: "error", text: t });
    const warn = (t: string) => msgs.push({ level: "warn", text: t });

    const name = get("name").replace(/\s+/g, " ");
    if (!name) err("Falta el nombre.");
    else if (name.length > 200) err("El nombre es muy largo (máximo 200 caracteres).");

    const stageRaw = get("stage");
    let stage: ClientImportRecord["stage"] | undefined = "CLIENT";
    if (stageRaw) {
      stage = (Object.entries(CLIENT_STAGE_LABELS).find(([code, label]) => norm(label) === norm(stageRaw) || norm(code) === norm(stageRaw))?.[0] ??
        undefined) as ClientImportRecord["stage"] | undefined;
      if (!stage && ["clientes", "prospectos", "leads"].includes(norm(stageRaw))) {
        stage = ({ clientes: "CLIENT", prospectos: "PROSPECT", leads: "LEAD" } as const)[norm(stageRaw) as "clientes"];
      }
      if (!stage) err(`«Etapa» no es válida: «${stageRaw}». Usa Cliente, Prospecto o Lead.`);
    }

    // Documento.
    const taxRaw = get("tax_id");
    let taxId: string | null = null;
    if (taxRaw) {
      let digits = taxRaw.replace(/\D/g, "");
      if (digits.length === 10) {
        digits = `0${digits}`;
        warn("A la cédula le faltaba el cero inicial (Excel lo quita): se completó.");
      }
      if (digits.length !== 9 && digits.length !== 11) err(`«${taxRaw}» no es un RNC (9 dígitos) ni una cédula (11).`);
      else {
        taxId = digits;
        if (existingIds.has(digits)) err("Ya existe un cliente con este RNC o cédula: se salta.");
        else if (seenIds.has(digits)) err(`Repetido en el archivo (igual que la fila ${seenIds.get(digits)}).`);
        else seenIds.set(digits, rowNo);
      }
    }
    const foreignId = get("foreign_id").replace(/\s+/g, "").toUpperCase() || null;
    if (foreignId && foreignId.length > 40) err("El ID extranjero es muy largo (máximo 40).");
    if (!taxId && !foreignId && name && stage === "CLIENT" && !msgs.some((m) => m.level === "error" && /RNC/.test(m.text))) {
      warn("Sin RNC ni cédula: no se le podrá emitir factura con crédito fiscal hasta completarlo en su ficha.");
    }

    // Ubicación.
    let provinceCode: string | null = null;
    let municipalityCode: string | null = null;
    const provRaw = get("province");
    const munRaw = get("municipality");
    if (provRaw) {
      provinceCode = provinceByName.get(norm(provRaw)) ?? provinceByName.get(norm(provRaw.replace(/^provincia\s+/i, ""))) ?? null;
      if (!provinceCode) err(`La provincia «${provRaw}» no existe. Elígela de la lista.`);
    }
    if (munRaw) {
      if (!provinceCode) {
        if (provRaw) {
          /* el error de provincia ya se dijo */
        } else err("Pusiste el municipio pero no la provincia.");
      } else {
        const places = placesByName(provinceCode);
        municipalityCode = places.get(norm(munRaw)) ?? places.get(norm(munRaw.replace(/^municipio\s+/i, ""))) ?? null;
        if (!municipalityCode) err(`El municipio «${munRaw}» no es de la provincia elegida. Revisa la hoja Listas.`);
      }
    }

    // Correos y contactos.
    const email = get("email").toLowerCase();
    if (email && !EMAIL.test(email)) err(`Correo inválido: «${email}».`);
    const contacts: Contact[] = [];
    const c1Name = get("c1_name").replace(/\s+/g, " ");
    const c1Email = get("c1_email").toLowerCase();
    if (c1Email && !EMAIL.test(c1Email)) err(`Correo del contacto principal inválido: «${c1Email}».`);
    const billRaw = get("c1_billing");
    let c1Billing: boolean | undefined = !billRaw ? Boolean(c1Email) : undefined;
    if (billRaw) {
      const b = norm(billRaw);
      if (["si", "s", "yes", "true", "verdadero", "1"].includes(b)) c1Billing = true;
      else if (["no", "n", "false", "falso", "0"].includes(b)) c1Billing = false;
      else err(`«¿Recibe recordatorios de cobro?» debe ser Sí o No (puso «${billRaw}»).`);
    }
    if (c1Name) {
      contacts.push({
        full_name: c1Name.slice(0, 200),
        position: get("c1_position") || null,
        email: c1Email || null,
        phone: get("c1_phone") || null,
        is_primary: true,
        receives_billing: c1Billing ?? false,
      });
      if (c1Billing && !c1Email) warn("El contacto principal recibe recordatorios pero no tiene correo.");
    } else if (c1Email || get("c1_phone") || get("c1_position")) {
      warn("Hay datos del contacto principal pero falta su nombre: no se guarda.");
    }
    const c2Name = get("c2_name").replace(/\s+/g, " ");
    const c2Email = get("c2_email").toLowerCase();
    if (c2Email && !EMAIL.test(c2Email)) err(`Correo del contacto de cobros inválido: «${c2Email}».`);
    if (c2Name) {
      contacts.push({
        full_name: c2Name.slice(0, 200),
        position: get("c2_position") || null,
        email: c2Email || null,
        phone: get("c2_phone") || null,
        is_primary: !c1Name,
        receives_billing: true,
      });
      if (!c2Email) warn("El contacto de cobros no tiene correo: no le llegarán los recordatorios.");
    } else if (c2Email || get("c2_phone") || get("c2_position")) {
      warn("Hay datos del contacto de cobros pero falta su nombre: no se guarda.");
    }
    if (name && stage === "CLIENT" && !contacts.some((c) => c.receives_billing && c.email)) {
      warn("Nadie recibirá los recordatorios de cobro por correo (ningún contacto con correo marcado para recibirlos).");
    }

    if (name && existingNames.has(norm(name)) && !msgs.some((m) => m.text.startsWith("Ya existe"))) {
      warn("Ya hay un cliente con este mismo nombre. Revisa que no sea el mismo.");
    }
    if (name) {
      const k = norm(name);
      if (seenNames.has(k) && !taxId) warn(`Mismo nombre que la fila ${seenNames.get(k)}.`);
      else seenNames.set(k, rowNo);
    }

    const hasError = msgs.some((m) => m.level === "error");
    msgs.sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
    results.push({
      row: rowNo,
      name,
      status: hasError ? "error" : msgs.length ? "warn" : "ok",
      messages: msgs,
      raw: CLIENT_IMPORT_COLUMNS.map((c) => get(c.key)),
      record: hasError
        ? null
        : {
            name,
            tax_id: taxId,
            foreign_id: foreignId,
            stage: stage!,
            email: email || null,
            phone: get("phone") || null,
            address: get("address") || null,
            province_code: provinceCode,
            municipality_code: municipalityCode,
            contacts,
          },
    });
  });
  if (results.length === 0) return { error: "No hay filas con datos debajo del encabezado.", results: [] };
  return { error: null, results };
}

const textCols = () => CLIENT_IMPORT_COLUMNS.map((c, i) => (c.text ? i : -1)).filter((i) => i >= 0);

/** Hojas de la plantilla: Clientes, Instrucciones (con ejemplos) y Listas (etapas, provincias, municipios). */
export function clientTemplateSheets() {
  const colOf = (k: ClientImportKey) => CLIENT_IMPORT_COLUMNS.findIndex((c) => c.key === k);
  const provinces = [...PROVINCES].sort((a, b) => a.label.localeCompare(b.label, "es"));
  const places: [string, string][] = [];
  for (const p of provinces) {
    for (const g of placesOfProvince(p.value)) {
      places.push([p.label, g.municipio.name]);
      for (const d of g.distritos) places.push([p.label, `${d.name}`]);
    }
  }
  const cols = [["Cliente", "Prospecto", "Lead"], ["Sí", "No"], provinces.map((p) => p.label), places.map((x) => x[0]), places.map((x) => x[1])];
  const lists: string[][] = [["Etapa", "Recibe recordatorios", "Provincia", "(provincia)", "Municipio o distrito"]];
  const height = Math.max(...cols.map((c) => c.length));
  for (let r = 0; r < height; r++) lists.push(cols.map((c) => c[r] ?? ""));
  const range = (col: number) => {
    const letter = String.fromCharCode(65 + col);
    return `Listas!$${letter}$2:$${letter}$${Math.max(2, cols[col].length + 1)}`;
  };
  const header = CLIENT_IMPORT_COLUMNS.map((c) => c.header);
  const examples = [
    ["Banco Ejemplo, S.A.", "101-00000-1", "", "Cliente", "eventos@bancoejemplo.com", "809-555-0300", "Av. Ejemplo 100", "Santo Domingo", "Santo Domingo Este", "María Gómez", "Gerente de Mercadeo", "maria@bancoejemplo.com", "809-555-0301", "No", "Pedro Ruiz", "Cuentas por pagar", "cxp@bancoejemplo.com", "809-555-0302"],
    ["Luisa Fernández", "001-0000000-1", "", "Lead", "", "829-555-0400", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Global Events LLC", "", "US-98-7654321", "Cliente", "billing@globalevents.com", "+1 305 555 0500", "Miami, FL", "", "", "John Smith", "Director", "john@globalevents.com", "", "Sí", "", "", "", ""],
  ];
  const instructions: string[][] = [
    ["Columna", "Qué poner"],
    ...CLIENT_IMPORT_COLUMNS.map((c) => [c.header, c.help]),
    ["", ""],
    ["Cómo usarla", "Llena la hoja «Clientes» desde la fila 2 (un cliente por fila). Las columnas con lista desplegable solo aceptan valores de la hoja «Listas». No cambies los títulos de la fila 1."],
    ["", "Después, en el sistema: Clientes → Importar desde Excel → sube este archivo → «Revisar» → «Importar». Nada se guarda hasta que pulses Importar."],
    ["", "Si un RNC o cédula ya existe en el sistema, esa fila se salta. Para más de dos contactos, agrégalos después en la ficha del cliente."],
    ["", ""],
    ["Ejemplos", "Estas filas son solo de ejemplo: NO las copies a la hoja «Clientes»."],
    header,
    ...examples,
  ];
  return [
    {
      name: CLIENT_IMPORT_SHEET,
      rows: [header],
      widths: CLIENT_IMPORT_COLUMNS.map((c) => c.width),
      textColumns: textCols(),
      header: true,
      freezeHeader: true,
      maxRows: CLIENT_IMPORT_MAX_ROWS + 1,
      lists: [
        { column: colOf("stage"), source: range(0) },
        { column: colOf("c1_billing"), source: range(1) },
        { column: colOf("province"), source: range(2) },
      ],
    },
    { name: "Instrucciones", rows: instructions, widths: [30, 110, ...Array(16).fill(18)], header: true },
    { name: "Listas", rows: lists, widths: [12, 20, 26, 26, 34], header: true, freezeHeader: true },
  ];
}

export function clientErrorSheets(rows: ClientImportRow[]) {
  return [
    {
      name: CLIENT_IMPORT_SHEET,
      rows: [
        [...CLIENT_IMPORT_COLUMNS.map((c) => c.header), "Motivo (esta columna se ignora al volver a subir)"],
        ...rows.map((r) => [...r.raw, r.messages.filter((m) => m.level === "error").map((m) => m.text).join(" · ")]),
      ],
      widths: [...CLIENT_IMPORT_COLUMNS.map((c) => c.width), 70],
      textColumns: textCols(),
      header: true,
      freezeHeader: true,
    },
  ];
}
