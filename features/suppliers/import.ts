/**
 * A3 — Carga masiva de proveedores con Excel: columnas de la plantilla y revisión fila por fila.
 * Funciones puras (sin base de datos): las usan la pantalla (vista previa) y el servidor (que vuelve a revisar todo
 * antes de guardar). No crea categorías ni tipos de servicio: si no existen, la fila sale con error y sugerencia.
 */
import { normalizeCatalogName } from "@/features/supplier-service-types/classification";
import { suggestClassification } from "./suggest-classification";
import {
  COUNTRIES,
  E_ISSUER_LABELS,
  FISCAL_CONDITION_LABELS,
  ID_TYPE_LABELS,
  SUPPLIER_KIND_LABELS,
} from "./fiscal";

export type SupplierImportColumn = {
  key: SupplierImportKey;
  header: string;
  help: string;
  width: number;
  text?: boolean;
  required?: boolean;
};

export type SupplierImportKey =
  | "name"
  | "id_type"
  | "tax_id"
  | "supplier_kind"
  | "fiscal_condition"
  | "e_issuer"
  | "tax_residence"
  | "country"
  | "foreign_tax_id"
  | "category"
  | "service_type"
  | "email"
  | "phone"
  | "address"
  | "bank_name"
  | "bank_account_number"
  | "contact_name"
  | "contact_position"
  | "contact_email"
  | "contact_phone";

export const SUPPLIER_IMPORT_COLUMNS: SupplierImportColumn[] = [
  { key: "name", header: "Nombre", help: "Obligatorio. Nombre del negocio o de la persona.", width: 34, required: true },
  { key: "id_type", header: "Tipo de documento", help: "RNC, Cédula, Pasaporte o Identificación extranjera. Si lo dejas vacío se deduce por la cantidad de dígitos.", width: 22 },
  { key: "tax_id", header: "RNC o cédula", help: "RNC: 9 dígitos. Cédula: 11 dígitos. Con o sin guiones.", width: 18, text: true },
  { key: "supplier_kind", header: "Tipo de proveedor", help: "Persona Física, Persona Jurídica, Negocio de Único Dueño u Otro.", width: 26 },
  { key: "fiscal_condition", header: "Condición fiscal", help: "Registrado DGII, Informal / no registrado, RST (régimen simplificado) u Otro.", width: 28 },
  { key: "e_issuer", header: "Emite e-CF", help: "Sí, No o No confirmado. Vacío = No confirmado.", width: 16 },
  { key: "tax_residence", header: "Reside en", help: "República Dominicana o Extranjero. Vacío = República Dominicana.", width: 24 },
  { key: "country", header: "País", help: "Solo si reside en el extranjero.", width: 18 },
  { key: "foreign_tax_id", header: "ID fiscal extranjero", help: "Solo si reside en el extranjero (Tax ID, NIF, etc.).", width: 20, text: true },
  { key: "category", header: "Categoría", help: "Una de tus categorías (hoja Listas). Si la dejas vacía y pones el tipo de servicio, se toma la de ese tipo.", width: 30 },
  { key: "service_type", header: "Tipo de servicio", help: "Uno de tus tipos de servicio (hoja Listas). Define cómo se tratan sus impuestos.", width: 32 },
  { key: "email", header: "Correo", help: "Correo del negocio.", width: 28 },
  { key: "phone", header: "Teléfono", help: "Teléfono del negocio.", width: 16, text: true },
  { key: "address", header: "Dirección", help: "Dirección del negocio.", width: 34 },
  { key: "bank_name", header: "Banco", help: "Banco donde se le paga (hoja Listas).", width: 22 },
  { key: "bank_account_number", header: "Número de cuenta", help: "Cuenta donde se le paga.", width: 22, text: true },
  { key: "contact_name", header: "Contacto: nombre", help: "Persona de contacto principal (opcional).", width: 26 },
  { key: "contact_position", header: "Contacto: cargo", help: "Cargo del contacto.", width: 20 },
  { key: "contact_email", header: "Contacto: correo", help: "Correo del contacto.", width: 28 },
  { key: "contact_phone", header: "Contacto: teléfono", help: "Teléfono del contacto.", width: 18, text: true },
];

export const SUPPLIER_IMPORT_SHEET = "Proveedores";
export const SUPPLIER_IMPORT_MAX_ROWS = 2000;

export type ImportCatalogs = {
  categories: { id: string; name: string }[];
  serviceTypes: { id: string; name: string; category_id: string }[];
  banks: string[];
  /** RNC/cédulas (solo dígitos) de proveedores que ya existen. */
  existingTaxIds: string[];
  /** Nombres (normalizados) de proveedores que ya existen. */
  existingNames: string[];
};

export type SupplierImportRecord = {
  name: string;
  id_type: string | null;
  tax_id: string | null;
  supplier_kind: string | null;
  fiscal_condition: string | null;
  e_issuer: string;
  tax_residence: "DO" | "EXTRANJERO";
  country_code: string | null;
  foreign_tax_id: string | null;
  category_id: string | null;
  category: string | null;
  service_type_id: string | null;
  service_type: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  contact: { full_name: string; position: string | null; email: string | null; phone: string | null } | null;
};

export type RowMessage = { level: "error" | "warn"; text: string };
export type SupplierImportRow = {
  /** Número de fila en el Excel (la 1 es el encabezado). */
  row: number;
  name: string;
  status: "ok" | "warn" | "error";
  messages: RowMessage[];
  record: SupplierImportRecord | null;
  /** Valores originales de la fila (para el Excel de errores). */
  raw: string[];
};

const norm = (s: string) => normalizeCatalogName(s ?? "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function fromLabels(value: string, labels: Record<string, string>, extra: Record<string, string> = {}): string | undefined {
  const v = norm(value);
  if (!v) return undefined;
  for (const [code, label] of Object.entries(labels)) {
    if (norm(label) === v || norm(code) === v || norm(code.replace(/_/g, " ")) === v) return code;
  }
  for (const [alias, code] of Object.entries(extra)) if (norm(alias) === v) return code;
  return undefined;
}

/** Busca las columnas por el texto del encabezado (sin importar mayúsculas, acentos ni orden). */
export function mapHeader(header: string[]): { index: Partial<Record<SupplierImportKey, number>>; missing: string[] } {
  const index: Partial<Record<SupplierImportKey, number>> = {};
  header.forEach((h, i) => {
    const col = SUPPLIER_IMPORT_COLUMNS.find((c) => norm(c.header) === norm(h));
    if (col && index[col.key] == null) index[col.key] = i;
  });
  const missing = SUPPLIER_IMPORT_COLUMNS.filter((c) => c.required && index[c.key] == null).map((c) => c.header);
  return { index, missing };
}

/**
 * Revisa todas las filas. `rows[0]` es el encabezado. Devuelve un resultado por fila con datos
 * (las filas totalmente vacías se ignoran).
 */
export function validateSupplierRows(rows: string[][], catalogs: ImportCatalogs): {
  error: string | null;
  results: SupplierImportRow[];
} {
  if (rows.length === 0) return { error: "El archivo está vacío.", results: [] };
  const { index, missing } = mapHeader(rows[0]);
  if (missing.length) {
    return {
      error: `No se encontró la columna «${missing.join("», «")}». Usa la plantilla descargada desde esta pantalla (hoja «${SUPPLIER_IMPORT_SHEET}»).`,
      results: [],
    };
  }
  const data = rows.slice(1);
  if (data.filter((r) => r.some((c) => c && c.trim())).length > SUPPLIER_IMPORT_MAX_ROWS) {
    return { error: `El archivo tiene más de ${SUPPLIER_IMPORT_MAX_ROWS} filas. Divídelo en partes.`, results: [] };
  }

  const catByName = new Map(catalogs.categories.map((c) => [norm(c.name), c]));
  const catById = new Map(catalogs.categories.map((c) => [c.id, c]));
  const typesByName = new Map<string, { id: string; name: string; category_id: string }[]>();
  for (const t of catalogs.serviceTypes) {
    const k = norm(t.name);
    typesByName.set(k, [...(typesByName.get(k) ?? []), t]);
  }
  const bankNames = new Map(catalogs.banks.map((b) => [norm(b), b]));
  const existingIds = new Set(catalogs.existingTaxIds);
  const existingNames = new Set(catalogs.existingNames.map(norm));
  const seenIds = new Map<string, number>();
  const seenNames = new Map<string, number>();

  const results: SupplierImportRow[] = [];
  data.forEach((raw, i) => {
    if (!raw.some((c) => c && c.trim())) return;
    const rowNo = i + 2;
    const get = (k: SupplierImportKey) => (index[k] != null ? String(raw[index[k]!] ?? "").trim() : "");
    const msgs: RowMessage[] = [];
    const err = (t: string) => msgs.push({ level: "error", text: t });
    const warn = (t: string) => msgs.push({ level: "warn", text: t });

    const name = get("name").replace(/\s+/g, " ");
    if (!name) err("Falta el nombre.");
    else if (name.length > 200) err("El nombre es muy largo (máximo 200 caracteres).");

    // Residencia y documento.
    const resRaw = get("tax_residence");
    const residence = !resRaw
      ? "DO"
      : fromLabels(resRaw, { DO: "República Dominicana", EXTRANJERO: "Extranjero" }, { RD: "DO", "Rep. Dominicana": "DO", Dominicana: "DO", "Exterior": "EXTRANJERO" });
    if (!residence) err(`«Reside en» no es válido: «${resRaw}». Usa República Dominicana o Extranjero.`);
    const foreign = residence === "EXTRANJERO";

    const idTypeRaw = get("id_type");
    let idType = fromLabels(idTypeRaw, ID_TYPE_LABELS, { Extranjero: "EXTRANJERO", "ID extranjero": "EXTRANJERO" }) ?? null;
    if (idTypeRaw && !idType) err(`«Tipo de documento» no es válido: «${idTypeRaw}».`);
    const taxRaw = get("tax_id");
    let taxId: string | null = null;
    if (taxRaw) {
      if (idType === "PASAPORTE" || idType === "EXTRANJERO") {
        taxId = taxRaw.replace(/\s+/g, "").toUpperCase();
      } else {
        let digits = taxRaw.replace(/\D/g, "");
        if (!idType) idType = digits.length === 9 ? "RNC" : digits.length === 11 || digits.length === 10 ? "CEDULA" : null;
        if (idType === "CEDULA" && digits.length === 10) {
          digits = `0${digits}`;
          warn("A la cédula le faltaba el cero inicial (Excel lo quita): se completó.");
        }
        if (idType === "RNC" && digits.length !== 9) err(`El RNC debe tener 9 dígitos (tiene ${digits.length}).`);
        else if (idType === "CEDULA" && digits.length !== 11) err(`La cédula debe tener 11 dígitos (tiene ${digits.length}).`);
        else if (!idType) err(`«${taxRaw}» no parece RNC (9 dígitos) ni cédula (11). Indica el tipo de documento.`);
        taxId = digits || null;
      }
      if (taxId) {
        const key = taxId.replace(/\W/g, "");
        if (existingIds.has(key)) err("Ya existe un proveedor con este RNC o cédula: se salta.");
        else if (seenIds.has(key)) err(`Repetido en el archivo (igual que la fila ${seenIds.get(key)}).`);
        else seenIds.set(key, rowNo);
      }
    } else if (idTypeRaw) {
      warn("Pusiste el tipo de documento pero no el número.");
    }

    // Perfil fiscal.
    const kindRaw = get("supplier_kind");
    const kind = fromLabels(kindRaw, SUPPLIER_KIND_LABELS, { Empresa: "PERSONA_JURIDICA", "Persona fisica": "PERSONA_FISICA", "Unico dueno": "UNICO_DUENO" }) ?? null;
    if (kindRaw && !kind) err(`«Tipo de proveedor» no es válido: «${kindRaw}».`);
    const condRaw = get("fiscal_condition");
    const cond = fromLabels(condRaw, FISCAL_CONDITION_LABELS, { Registrado: "REGISTRADO", Informal: "INFORMAL", "No registrado": "INFORMAL" }) ?? null;
    if (condRaw && !cond) err(`«Condición fiscal» no es válida: «${condRaw}».`);
    if ((!kindRaw || !condRaw) && name) {
      warn("Faltan el tipo de proveedor o la condición fiscal: sus gastos quedarán «por revisar» hasta completarlos en su ficha.");
    }
    const eRaw = get("e_issuer");
    const eIssuer = !eRaw ? "NO_CONFIRMADO" : fromLabels(eRaw, E_ISSUER_LABELS, { Si: "SI", "Sí": "SI", No: "NO" });
    if (!eIssuer) err(`«Emite e-CF» no es válido: «${eRaw}». Usa Sí, No o No confirmado.`);

    let countryCode: string | null = null;
    const countryRaw = get("country");
    if (foreign) {
      if (!countryRaw) err("Indica el país del proveedor extranjero.");
      else {
        const c = COUNTRIES.find((x) => norm(x.name) === norm(countryRaw) || x.code === countryRaw.toUpperCase());
        if (c) countryCode = c.code;
        else if (/^[A-Za-z]{2}$/.test(countryRaw)) countryCode = countryRaw.toUpperCase();
        else err(`País no reconocido: «${countryRaw}». Elige uno de la lista o escribe su código de 2 letras (ej. US).`);
      }
    } else if (countryRaw || get("foreign_tax_id")) {
      warn("Puso país o ID extranjero pero «Reside en» es República Dominicana: se ignoran.");
    }

    // Categoría y tipo de servicio (sin crear nada nuevo).
    let category: { id: string; name: string } | null = null;
    let serviceType: { id: string; name: string; category_id: string } | null = null;
    const catRaw = get("category");
    const typeRaw = get("service_type");
    if (catRaw) {
      category = catByName.get(norm(catRaw)) ?? null;
      if (!category) err(`La categoría «${catRaw}» no existe. Cópiala de la hoja Listas o créala primero en Configuración.`);
    }
    if (typeRaw) {
      const found = typesByName.get(norm(typeRaw)) ?? [];
      const inCat = category ? found.filter((t) => t.category_id === category!.id) : found;
      if (found.length === 0) err(`El tipo de servicio «${typeRaw}» no existe. Cópialo de la hoja Listas o créalo primero en Configuración.`);
      else if (category && inCat.length === 0) {
        err(`El tipo de servicio «${typeRaw}» no pertenece a la categoría «${category.name}» (pertenece a «${catById.get(found[0].category_id)?.name ?? "otra"}»).`);
      } else if (!category && inCat.length > 1) err(`Hay varios tipos de servicio «${typeRaw}»: indica también la categoría.`);
      else {
        serviceType = inCat[0];
        if (!category) category = catById.get(serviceType.category_id) ?? null;
      }
    }
    if (!catRaw && !typeRaw && name) {
      const s = suggestClassification(name, catalogs.categories, catalogs.serviceTypes, 1)[0];
      warn(
        s
          ? `No tiene categoría ni tipo de servicio. Sugerencia por el nombre: ${s.categoryName} · ${s.serviceTypeName} (complétalo en su ficha o en el Excel).`
          : "No tiene categoría ni tipo de servicio: complétalo en su ficha para que sus gastos se clasifiquen bien.",
      );
    } else if (category && !serviceType && !typeRaw) {
      warn("Tiene categoría pero no tipo de servicio: los impuestos de sus gastos dependen del tipo de servicio.");
    }

    // Contacto y datos de contacto.
    const email = get("email").toLowerCase();
    if (email && !EMAIL.test(email)) err(`Correo inválido: «${email}».`);
    const bankRaw = get("bank_name");
    let bankName: string | null = bankRaw || null;
    if (bankRaw) {
      const b = bankNames.get(norm(bankRaw));
      if (b) bankName = b;
      else warn(`El banco «${bankRaw}» no está en el catálogo de bancos: se guarda tal cual.`);
    }
    const cName = get("contact_name").replace(/\s+/g, " ");
    const cEmail = get("contact_email").toLowerCase();
    if (cEmail && !EMAIL.test(cEmail)) err(`Correo del contacto inválido: «${cEmail}».`);
    if (!cName && (cEmail || get("contact_phone") || get("contact_position"))) {
      warn("Hay datos del contacto pero falta su nombre: el contacto no se guarda.");
    }

    if (name && existingNames.has(norm(name)) && !msgs.some((m) => m.text.startsWith("Ya existe"))) {
      warn("Ya hay un proveedor con este mismo nombre (sin el mismo RNC). Revisa que no sea el mismo.");
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
      raw: SUPPLIER_IMPORT_COLUMNS.map((c) => get(c.key)),
      record: hasError
        ? null
        : {
            name,
            id_type: idType,
            tax_id: taxId,
            supplier_kind: kind,
            fiscal_condition: cond,
            e_issuer: eIssuer!,
            tax_residence: foreign ? "EXTRANJERO" : "DO",
            country_code: foreign ? countryCode : null,
            foreign_tax_id: foreign ? get("foreign_tax_id") || null : null,
            category_id: category?.id ?? null,
            category: category?.name ?? null,
            service_type_id: serviceType?.id ?? null,
            service_type: serviceType?.name ?? null,
            email: email || null,
            phone: get("phone") || null,
            address: get("address") || null,
            bank_name: bankName,
            bank_account_number: get("bank_account_number").replace(/\s+/g, "") || null,
            contact: cName
              ? { full_name: cName.slice(0, 200), position: get("contact_position") || null, email: cEmail || null, phone: get("contact_phone") || null }
              : null,
          },
    });
  });
  if (results.length === 0) return { error: "No hay filas con datos debajo del encabezado.", results: [] };
  return { error: null, results };
}

/** Hojas de la plantilla: Proveedores (encabezado + 3 ejemplos en Instrucciones), Instrucciones y Listas. */
export function supplierTemplateSheets(catalogs: Pick<ImportCatalogs, "categories" | "serviceTypes" | "banks">) {
  const catName = new Map(catalogs.categories.map((c) => [c.id, c.name]));
  const lists: string[][] = [
    ["Tipo de documento", "Tipo de proveedor", "Condición fiscal", "Emite e-CF", "Reside en", "País", "Categoría", "Tipo de servicio", "(categoría del tipo)", "Banco"],
  ];
  const cols = [
    Object.values(ID_TYPE_LABELS),
    Object.values(SUPPLIER_KIND_LABELS),
    Object.values(FISCAL_CONDITION_LABELS),
    ["Sí", "No", "No confirmado"],
    ["República Dominicana", "Extranjero"],
    COUNTRIES.filter((c) => c.code !== "OT").map((c) => c.name),
    [...catalogs.categories].map((c) => c.name).sort((a, b) => a.localeCompare(b, "es")),
    [...catalogs.serviceTypes].sort((a, b) => a.name.localeCompare(b.name, "es")).map((t) => t.name),
    [...catalogs.serviceTypes].sort((a, b) => a.name.localeCompare(b.name, "es")).map((t) => catName.get(t.category_id) ?? ""),
    [...catalogs.banks].sort((a, b) => a.localeCompare(b, "es")),
  ];
  const height = Math.max(...cols.map((c) => c.length));
  for (let r = 0; r < height; r++) lists.push(cols.map((c) => c[r] ?? ""));
  const range = (col: number) => {
    const letter = String.fromCharCode(65 + col);
    return `Listas!$${letter}$2:$${letter}$${Math.max(2, cols[col].length + 1)}`;
  };
  const colOf = (k: SupplierImportKey) => SUPPLIER_IMPORT_COLUMNS.findIndex((c) => c.key === k);

  const header = SUPPLIER_IMPORT_COLUMNS.map((c) => c.header);
  const examples: string[][] = [
    ["Sonido Profesional SRL", "RNC", "131234567", "Persona Jurídica", "Registrado DGII", "Sí", "República Dominicana", "", "", "", "", "ventas@sonidopro.com", "809-555-0101", "Av. Ejemplo 10, Santo Domingo", "", "", "Ana Pérez", "Ventas", "ana@sonidopro.com", "809-555-0102"],
    ["Juan Martínez (fotógrafo)", "Cédula", "00112345678", "Persona Física", "Informal / no registrado", "No", "República Dominicana", "", "", "", "", "", "829-555-0200", "", "", "", "", "", "", ""],
    ["Event Supplies Inc.", "Identificación extranjera", "", "Persona Jurídica", "Otro", "No", "Extranjero", "Estados Unidos", "12-3456789", "", "", "info@eventsupplies.com", "+1 305 555 0100", "Miami, FL", "", "", "", "", "", ""],
  ];
  const instructions: string[][] = [
    ["Columna", "Qué poner"],
    ...SUPPLIER_IMPORT_COLUMNS.map((c) => [c.header, c.help]),
    ["", ""],
    ["Cómo usarla", "Llena la hoja «Proveedores» desde la fila 2 (una fila por proveedor). Las columnas con lista desplegable solo aceptan valores de la hoja «Listas». No cambies los títulos de la fila 1."],
    ["", "Después, en el sistema: Proveedores → Importar → sube este archivo → «Revisar archivo» → «Importar». Nada se guarda hasta que pulses Importar."],
    ["", "Si un RNC o cédula ya existe en el sistema, esa fila se salta. Las categorías y tipos de servicio deben existir (no se crean nuevos)."],
    ["", ""],
    ["Ejemplos", "Estas filas son solo de ejemplo: NO las copies a la hoja «Proveedores»."],
    header,
    ...examples,
  ];
  return [
    {
      name: SUPPLIER_IMPORT_SHEET,
      rows: [header],
      widths: SUPPLIER_IMPORT_COLUMNS.map((c) => c.width),
      textColumns: SUPPLIER_IMPORT_COLUMNS.map((c, i) => (c.text ? i : -1)).filter((i) => i >= 0),
      header: true,
      freezeHeader: true,
      maxRows: SUPPLIER_IMPORT_MAX_ROWS + 1,
      lists: [
        { column: colOf("id_type"), source: range(0) },
        { column: colOf("supplier_kind"), source: range(1) },
        { column: colOf("fiscal_condition"), source: range(2) },
        { column: colOf("e_issuer"), source: range(3) },
        { column: colOf("tax_residence"), source: range(4) },
        { column: colOf("country"), source: range(5) },
        { column: colOf("category"), source: range(6) },
        { column: colOf("service_type"), source: range(7) },
        { column: colOf("bank_name"), source: range(9) },
      ],
    },
    { name: "Instrucciones", rows: instructions, widths: [26, 110, ...Array(18).fill(18)], header: true },
    { name: "Listas", rows: lists, widths: [24, 24, 26, 14, 22, 18, 32, 34, 30, 24], header: true, freezeHeader: true },
  ];
}

/** Excel con las filas que no se importaron y el motivo (para corregir y volver a subir). */
export function supplierErrorSheets(rows: SupplierImportRow[]) {
  return [
    {
      name: SUPPLIER_IMPORT_SHEET,
      rows: [
        [...SUPPLIER_IMPORT_COLUMNS.map((c) => c.header), "Motivo (esta columna se ignora al volver a subir)"],
        ...rows.map((r) => [...r.raw, r.messages.filter((m) => m.level === "error").map((m) => m.text).join(" · ")]),
      ],
      widths: [...SUPPLIER_IMPORT_COLUMNS.map((c) => c.width), 70],
      textColumns: SUPPLIER_IMPORT_COLUMNS.map((c, i) => (c.text ? i : -1)).filter((i) => i >= 0),
      header: true,
      freezeHeader: true,
    },
  ];
}
