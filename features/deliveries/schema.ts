import { z } from "zod";

/**
 * Entregas y acuses de recibo (migración 067). Un acuse registra lo que se
 * le entregó a un cliente (documentos, equipos, materiales u otros
 * artículos); se imprime para firma manual y luego se adjunta firmado.
 */

export const DELIVERY_STATUSES = ["DRAFT", "ISSUED", "SIGNED", "CANCELLED"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  ISSUED: "Pendiente de firma",
  SIGNED: "Firmado",
  CANCELLED: "Anulado",
};

export const DELIVERY_STATUS_TONE: Record<string, "warning" | "info" | "success" | "danger"> = {
  DRAFT: "warning",
  ISSUED: "info",
  SIGNED: "success",
  CANCELLED: "danger",
};

/** Pasos que se muestran arriba del acuse (el anulado no tiene pasos). */
export const DELIVERY_FLOW = ["DRAFT", "ISSUED", "SIGNED"] as const;
export const DELIVERY_FLOW_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  ISSUED: "Impreso / pendiente de firma",
  SIGNED: "Firmado y adjunto",
};

export const DELIVERY_TYPES = ["DOCUMENTS", "EQUIPMENT", "MATERIALS", "OTHER"] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

export const DELIVERY_TYPE_LABELS: Record<string, string> = {
  DOCUMENTS: "Documentos",
  EQUIPMENT: "Equipos",
  MATERIALS: "Materiales",
  OTHER: "Otros artículos",
};

/** Textos del acuse que cambian según lo que se entrega. */
export const DELIVERY_TYPE_TEXT: Record<
  string,
  { subtitle: string; noun: string; itemHeader: string; referenceHeader: string; totalLabel: string }
> = {
  DOCUMENTS: {
    subtitle: "Documentos de proveedor",
    noun: "documentos",
    itemHeader: "Descripción del documento",
    referenceHeader: "Referencia",
    totalLabel: "Total de documentos entregados",
  },
  EQUIPMENT: {
    subtitle: "Entrega de equipos",
    noun: "equipos",
    itemHeader: "Descripción del equipo",
    referenceHeader: "Referencia / Serie",
    totalLabel: "Total de equipos entregados",
  },
  MATERIALS: {
    subtitle: "Entrega de materiales",
    noun: "materiales",
    itemHeader: "Descripción del material",
    referenceHeader: "Referencia",
    totalLabel: "Total de materiales entregados",
  },
  OTHER: {
    subtitle: "Entrega de artículos",
    noun: "artículos",
    itemHeader: "Descripción del artículo",
    referenceHeader: "Referencia",
    totalLabel: "Total de artículos entregados",
  },
};

export const DEFAULT_DELIVERY_PLACE = "Santo Domingo, D.N.";

const COPIES_WORDS = ["", "un (1) ejemplar", "dos (2) ejemplares", "tres (3) ejemplares", "cuatro (4) ejemplares", "cinco (5) ejemplares"];

/** Párrafo de entrada por defecto ("Por medio de la presente…"). */
export function defaultIntroText(params: {
  companyName: string;
  recipientName: string;
  recipientShortName?: string | null;
  deliveryType: string;
  reference?: string | null;
}): string {
  const noun = DELIVERY_TYPE_TEXT[params.deliveryType]?.noun ?? "artículos";
  const recipient = params.recipientShortName?.trim()
    ? `${params.recipientName.trim()} (${params.recipientShortName.trim()})`
    : params.recipientName.trim();
  const ref = params.reference?.trim();
  return (
    `Por medio de la presente, ${params.companyName.toUpperCase()} hace formal entrega a ${recipient || "el destinatario"} ` +
    `de los ${noun} que se detallan a continuación` +
    (ref ? `, correspondientes a ${ref}.` : ".")
  );
}

/** Nota al pie por defecto ("La firma del presente acuse certifica…"). */
export function defaultFooterNote(deliveryType: string, copies: number): string {
  const noun = DELIVERY_TYPE_TEXT[deliveryType]?.noun ?? "artículos";
  const n = Math.min(5, Math.max(1, Math.round(copies || 2)));
  return `La firma del presente acuse certifica la recepción de los ${noun} arriba indicados. Se emite en ${COPIES_WORDS[n]}.`;
}

export const deliveryItemSchema = z.object({
  description: z.string().trim().min(1, "Cada línea necesita una descripción."),
  reference: z.string().trim().max(200).optional().or(z.literal("")),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0.").max(99999),
});

export type DeliveryItemInput = z.infer<typeof deliveryItemSchema>;

export const deliveryHeaderSchema = z.object({
  client_id: z.string().uuid("Elige el cliente."),
  project_id: z.string().uuid().optional().or(z.literal("")),
  delivery_type: z.enum(DELIVERY_TYPES),
  subtitle: z.string().trim().max(80).optional().or(z.literal("")),
  delivery_date: z.string().min(1, "La fecha es requerida."),
  place: z.string().trim().max(120).optional().or(z.literal("")),
  recipient_name: z.string().trim().min(1, "Escribe a quién se entrega (destinatario).").max(200),
  recipient_short_name: z.string().trim().max(60).optional().or(z.literal("")),
  recipient_department: z.string().trim().max(200).optional().or(z.literal("")),
  reference: z.string().trim().max(300).optional().or(z.literal("")),
  intro_text: z.string().trim().max(2000).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  copies: z.coerce.number().int().min(1).max(5).default(2),
  delivered_by_name: z.string().trim().max(120).optional().or(z.literal("")),
  delivered_by_id_number: z.string().trim().max(40).optional().or(z.literal("")),
});

export type DeliveryHeaderInput = z.infer<typeof deliveryHeaderSchema>;

export const signedUploadSchema = z.object({
  received_by_name: z.string().trim().max(120).optional().or(z.literal("")),
  received_by_position: z.string().trim().max(120).optional().or(z.literal("")),
  received_at: z.string().optional().or(z.literal("")),
});

/** Total que va en "Total de … entregados": suma de cantidades. */
export function totalQuantity(items: { quantity: number }[]): number {
  return items.reduce((acc, i) => acc + Number(i.quantity || 0), 0);
}

/** "05", "12", "3.5" — como en el modelo (dos dígitos). */
export function formatTotal(n: number): string {
  return Number.isInteger(n) ? String(n).padStart(2, "0") : n.toFixed(2);
}

/** Muestra la columna "Cant." si no es un acuse de documentos o si alguna línea tiene cantidad ≠ 1. */
export function showQuantityColumn(deliveryType: string, items: { quantity: number }[]): boolean {
  return deliveryType !== "DOCUMENTS" || items.some((i) => Number(i.quantity) !== 1);
}
