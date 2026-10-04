/**
 * Motor fiscal — la ÚNICA pieza que decide retenciones (fase 4 de
 * claude/propuesta-tratamiento-fiscal.md). Función pura: no lee la base de
 * datos, recibe el contexto y las reglas y devuelve el resultado con su
 * explicación. Gastos, Pagos y Bancos no contienen porcentajes ni reglas.
 *
 * Nunca inventa una retención: si falta información o no hay regla, lo dice
 * y devuelve retención 0 (el gasto queda "por revisar").
 */

import { FISCAL_CONDITION_LABELS, SUPPLIER_KIND_LABELS } from "@/features/suppliers/fiscal";

export type FiscalRule = {
  id: string;
  rule_key: string;
  version: number;
  name: string;
  description: string | null;
  priority: number;
  is_active: boolean;
  valid_from: string; // YYYY-MM-DD
  valid_to: string | null;
  supplier_kinds: string[] | null;
  fiscal_conditions: string[] | null;
  tax_residence: string | null;
  country_code: string | null;
  operation_type: string | null;
  fiscal_classification_id: string | null;
  document_types: string[] | null;
  e_issuer: string | null;
  action: "RETAIN" | "NO_RETENTION" | "REVIEW" | "BLOCK";
  isr_rate: number;
  isr_base_pct: number;
  itbis_retention_pct: number;
  user_message: string | null;
  legal_source: string | null;
  legal_article: string | null;
  reference_url: string | null;
  needs_review: boolean;
};

export type FiscalContext = {
  date: string; // YYYY-MM-DD de la operación
  supplier: {
    name?: string | null;
    supplier_kind: string | null;
    fiscal_condition: string | null;
    tax_residence: string | null;
    country_code: string | null;
    e_issuer: string | null;
  } | null;
  serviceTypeId: string | null;
  fiscalClassificationId: string | null;
  documentType: string | null;
  subtotal: number;
  itbis: number;
  total: number;
};

export type FiscalStatus =
  | "NO_SUPPLIER"
  | "MISSING_DATA"
  | "NO_RULE"
  | "REVIEW"
  | "BLOCKED"
  | "NO_RETENTION"
  | "APPLIED";

export type FiscalResult = {
  status: FiscalStatus;
  rule: FiscalRule | null;
  /** Reglas que coincidían (para "Probar regla" y para explicar empates). */
  candidates: FiscalRule[];
  operationType: "COMPRA_LOCAL" | "PAGO_EXTERIOR";
  isrRate: number;
  isrBasePct: number;
  itbisRetentionPct: number;
  isrWithheld: number;
  itbisWithheld: number;
  totalWithheld: number;
  netPayable: number;
  /** Qué falta (lista para mostrar). */
  missing: string[];
  /** Mensaje principal, en lenguaje sencillo. */
  message: string;
  /** "¿Por qué se aplicó esto?" */
  explanation: string;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function inList(list: string[] | null, value: string | null): boolean {
  if (!list || list.length === 0) return true;
  return value !== null && list.includes(value);
}

function eq(cond: string | null, value: string | null): boolean {
  return cond === null || cond === value;
}

/** Cantidad de condiciones que la regla exige (para desempatar: más específica gana). */
export function ruleSpecificity(r: FiscalRule): number {
  return [
    r.supplier_kinds?.length ? 1 : 0,
    r.fiscal_conditions?.length ? 1 : 0,
    r.tax_residence ? 1 : 0,
    r.country_code ? 1 : 0,
    r.operation_type ? 1 : 0,
    r.fiscal_classification_id ? 1 : 0,
    r.document_types?.length ? 1 : 0,
    r.e_issuer ? 1 : 0,
  ].reduce((a, b) => a + b, 0);
}

export type RuleState = "ACTIVE" | "SCHEDULED" | "EXPIRED" | "INACTIVE";

/** Vigente · Programada · Vencida · Inactiva, para una fecha (hoy por defecto). */
export function ruleState(r: Pick<FiscalRule, "is_active" | "valid_from" | "valid_to">, today: string): RuleState {
  if (!r.is_active) return "INACTIVE";
  if (r.valid_from > today) return "SCHEDULED";
  if (r.valid_to && r.valid_to < today) return "EXPIRED";
  return "ACTIVE";
}

export function ruleMatches(r: FiscalRule, ctx: FiscalContext, operationType: string): boolean {
  if (!r.is_active) return false;
  if (r.valid_from > ctx.date) return false;
  if (r.valid_to && r.valid_to < ctx.date) return false;
  const s = ctx.supplier;
  return (
    inList(r.supplier_kinds, s?.supplier_kind ?? null) &&
    inList(r.fiscal_conditions, s?.fiscal_condition ?? null) &&
    eq(r.tax_residence, s?.tax_residence ?? "DO") &&
    eq(r.country_code, s?.country_code ?? null) &&
    eq(r.operation_type, operationType) &&
    eq(r.fiscal_classification_id, ctx.fiscalClassificationId) &&
    inList(r.document_types, ctx.documentType) &&
    eq(r.e_issuer, s?.e_issuer ?? null)
  );
}

function sameOutcome(a: FiscalRule, b: FiscalRule): boolean {
  return (
    a.action === b.action &&
    Number(a.isr_rate) === Number(b.isr_rate) &&
    Number(a.isr_base_pct) === Number(b.isr_base_pct) &&
    Number(a.itbis_retention_pct) === Number(b.itbis_retention_pct)
  );
}

/** Orden de evaluación: prioridad (menor primero), más específica, versión más nueva. */
export function sortRules(rules: FiscalRule[]): FiscalRule[] {
  return [...rules].sort(
    (a, b) =>
      a.priority - b.priority ||
      ruleSpecificity(b) - ruleSpecificity(a) ||
      b.version - a.version ||
      a.name.localeCompare(b.name),
  );
}

export function evaluateFiscal(ctx: FiscalContext, rules: FiscalRule[]): FiscalResult {
  const total = round2(ctx.total);
  const operationType = ctx.supplier?.tax_residence === "EXTRANJERO" ? "PAGO_EXTERIOR" : "COMPRA_LOCAL";
  const base: FiscalResult = {
    status: "NO_RULE",
    rule: null,
    candidates: [],
    operationType,
    isrRate: 0,
    isrBasePct: 100,
    itbisRetentionPct: 0,
    isrWithheld: 0,
    itbisWithheld: 0,
    totalWithheld: 0,
    netPayable: total,
    missing: [],
    message: "",
    explanation: "",
  };

  if (!ctx.supplier) {
    return {
      ...base,
      status: "NO_SUPPLIER",
      message: "Este gasto no tiene proveedor: no se calculan retenciones.",
      explanation: "Las retenciones dependen de quién es el proveedor. Sin proveedor se paga el total.",
    };
  }

  const missing: string[] = [];
  if (operationType === "COMPRA_LOCAL") {
    if (!ctx.supplier.supplier_kind) missing.push("Falta definir el tipo de proveedor (Persona Física o Jurídica).");
    if (!ctx.supplier.fiscal_condition) missing.push("Falta definir la condición fiscal del proveedor.");
  }
  if (!ctx.serviceTypeId) missing.push("Elige el tipo de servicio del gasto.");
  else if (!ctx.fiscalClassificationId) missing.push("Este tipo de servicio todavía no tiene clasificación fiscal.");

  const candidates = sortRules(rules.filter((r) => ruleMatches(r, ctx, operationType)));

  // Con datos faltantes solo sirven reglas que no dependen de ellos (ej. pago al exterior).
  if (missing.length > 0 && candidates.length === 0) {
    return {
      ...base,
      status: "MISSING_DATA",
      missing,
      message: missing[0],
      explanation:
        "Para saber qué retenciones aplicar el sistema necesita conocer al proveedor y el tipo de servicio. Completa lo que falta; mientras tanto se paga el total y el gasto queda marcado para revisión.",
    };
  }

  if (candidates.length === 0) {
    return {
      ...base,
      status: "NO_RULE",
      message: "No existe una regla vigente para esta combinación.",
      explanation:
        "El sistema no encontró ninguna regla fiscal activa para este proveedor, tipo de servicio y fecha. No se inventa una retención: se paga el total y el gasto queda por revisar. Puedes crear la regla en Configuración → Reglas fiscales.",
    };
  }

  const top = candidates[0];
  const tied = candidates.filter(
    (r) => r.priority === top.priority && ruleSpecificity(r) === ruleSpecificity(top) && r.rule_key !== top.rule_key,
  );
  if (tied.some((r) => !sameOutcome(r, top))) {
    return {
      ...base,
      status: "REVIEW",
      candidates,
      missing,
      message: "Existen varias reglas posibles y se requiere revisión.",
      explanation: `Coinciden con la misma prioridad: ${[top, ...tied].map((r) => `"${r.name}"`).join(", ")}. Ajusta la prioridad de una de ellas en Configuración → Reglas fiscales.`,
    };
  }

  const why = `El sistema identificó al proveedor (${
    [
      ctx.supplier.supplier_kind ? SUPPLIER_KIND_LABELS[ctx.supplier.supplier_kind] ?? ctx.supplier.supplier_kind : null,
      ctx.supplier.fiscal_condition
        ? FISCAL_CONDITION_LABELS[ctx.supplier.fiscal_condition] ?? ctx.supplier.fiscal_condition
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || "datos fiscales"
  }) y la clasificación del servicio, y encontró una regla fiscal vigente que aplica a esta operación: "${top.name}"${top.version > 1 ? ` (versión ${top.version})` : ""}.`;

  if (top.action === "BLOCK") {
    return {
      ...base,
      status: "BLOCKED",
      rule: top,
      candidates,
      missing,
      message: top.user_message || "Esta combinación no está permitida.",
      explanation: why,
    };
  }
  if (top.action === "REVIEW") {
    return {
      ...base,
      status: "REVIEW",
      rule: top,
      candidates,
      missing,
      message: top.user_message || "Esta operación requiere revisión manual.",
      explanation: why,
    };
  }
  if (top.action === "NO_RETENTION") {
    return {
      ...base,
      status: "NO_RETENTION",
      rule: top,
      candidates,
      missing,
      message: top.user_message || "No corresponde retención para esta operación según la regla vigente.",
      explanation: `${why} Se le paga el total al proveedor.`,
    };
  }

  const isrRate = Number(top.isr_rate);
  const isrBasePct = Number(top.isr_base_pct);
  const itbisPct = Number(top.itbis_retention_pct);
  const isr = round2(Math.max(0, ctx.subtotal) * (isrBasePct / 100) * (isrRate / 100));
  const itbis = round2(Math.max(0, ctx.itbis) * (itbisPct / 100));
  const totalWithheld = round2(Math.min(isr + itbis, Math.max(0, total)));
  return {
    ...base,
    status: "APPLIED",
    rule: top,
    candidates,
    missing,
    isrRate,
    isrBasePct,
    itbisRetentionPct: itbisPct,
    isrWithheld: isr,
    itbisWithheld: itbis,
    totalWithheld,
    netPayable: round2(Math.max(0, total - totalWithheld)),
    message:
      totalWithheld > 0
        ? "Se aplican retenciones según la regla vigente."
        : "La regla vigente no genera retención para estos montos.",
    explanation: why,
  };
}

/** Texto corto del tratamiento de una regla: "ISR 15 % s/20 % · ITBIS 100 %". */
export function describeTreatment(r: Pick<FiscalRule, "action" | "isr_rate" | "isr_base_pct" | "itbis_retention_pct">): string {
  if (r.action === "NO_RETENTION") return "Sin retención";
  if (r.action === "REVIEW") return "Revisión manual";
  if (r.action === "BLOCK") return "Bloquear";
  const parts: string[] = [];
  const isr = Number(r.isr_rate);
  const base = Number(r.isr_base_pct);
  const itbis = Number(r.itbis_retention_pct);
  if (isr > 0) parts.push(`ISR ${isr} %${base < 100 ? ` s/${base} %` : ""}`);
  if (itbis > 0) parts.push(`ITBIS ${itbis} %`);
  return parts.join(" · ") || "Sin retención";
}
