import { describe, it, expect } from "vitest";
import { evaluateFiscal, ruleState, describeTreatment, type FiscalRule, type FiscalContext } from "@/features/fiscal/engine";

const C = { TEC: "c-tec", PRO: "c-pro", BIEN: "c-bien", ALQ: "c-alq", COM: "c-com", SEG: "c-seg", EXE: "c-exe", SIN: "c-sin" };
const PF = ["PERSONA_FISICA", "UNICO_DUENO"];
let n = 0;
function rule(p: Partial<FiscalRule>): FiscalRule {
  n++;
  return {
    id: `r${n}`, rule_key: p.rule_key ?? `R${n}`, version: 1, name: p.rule_key ?? `Regla ${n}`, description: null, priority: 50, is_active: true,
    valid_from: "2000-01-01", valid_to: null, supplier_kinds: null, fiscal_conditions: null, tax_residence: null, country_code: null,
    operation_type: null, fiscal_classification_id: null, document_types: null, e_issuer: null, action: "RETAIN",
    isr_rate: 0, isr_base_pct: 100, itbis_retention_pct: 0, user_message: null, legal_source: null, legal_article: null,
    reference_url: null, needs_review: true, ...p,
  };
}

// Mismas reglas que la carga inicial (migración 073).
const RULES: FiscalRule[] = [
  rule({ rule_key: "PF_PRO", version: 1, valid_to: "2026-06-30", supplier_kinds: PF, fiscal_conditions: ["REGISTRADO"], tax_residence: "DO", fiscal_classification_id: C.PRO, isr_rate: 10, itbis_retention_pct: 100 }),
  rule({ rule_key: "PF_PRO", version: 2, valid_from: "2026-07-01", supplier_kinds: PF, fiscal_conditions: ["REGISTRADO"], tax_residence: "DO", fiscal_classification_id: C.PRO, isr_rate: 15, itbis_retention_pct: 100 }),
  rule({ rule_key: "PF_TEC", version: 1, valid_to: "2026-06-30", supplier_kinds: PF, fiscal_conditions: ["REGISTRADO"], tax_residence: "DO", fiscal_classification_id: C.TEC, isr_rate: 2, itbis_retention_pct: 100 }),
  rule({ rule_key: "PF_TEC", version: 2, valid_from: "2026-07-01", supplier_kinds: PF, fiscal_conditions: ["REGISTRADO"], tax_residence: "DO", fiscal_classification_id: C.TEC, isr_rate: 15, isr_base_pct: 20, itbis_retention_pct: 100 }),
  rule({ rule_key: "BIENES", priority: 60, fiscal_conditions: ["REGISTRADO"], tax_residence: "DO", fiscal_classification_id: C.BIEN, action: "NO_RETENTION" }),
  rule({ rule_key: "EXENTO", priority: 20, fiscal_classification_id: C.EXE, action: "NO_RETENTION" }),
  rule({ rule_key: "PJ_PRO", supplier_kinds: ["PERSONA_JURIDICA"], fiscal_conditions: ["REGISTRADO"], tax_residence: "DO", fiscal_classification_id: C.PRO, itbis_retention_pct: 30 }),
  rule({ rule_key: "PJ_PRO_ECF", priority: 10, valid_from: "2026-09-16", supplier_kinds: ["PERSONA_JURIDICA"], fiscal_conditions: ["REGISTRADO"], tax_residence: "DO", fiscal_classification_id: C.PRO, document_types: ["E31"], e_issuer: "SI", action: "NO_RETENTION" }),
  rule({ rule_key: "PJ_RESTO", priority: 90, supplier_kinds: ["PERSONA_JURIDICA"], fiscal_conditions: ["REGISTRADO"], tax_residence: "DO", action: "NO_RETENTION", user_message: "No corresponde retención para esta operación según la regla vigente." }),
  rule({ rule_key: "INFORMAL", priority: 30, fiscal_conditions: ["INFORMAL"], tax_residence: "DO", action: "REVIEW", user_message: "Proveedor informal: revisar." }),
  rule({ rule_key: "RST", priority: 30, fiscal_conditions: ["RST"], tax_residence: "DO", action: "REVIEW" }),
  rule({ rule_key: "EXTERIOR", priority: 30, tax_residence: "EXTRANJERO", action: "REVIEW", user_message: "Pago al exterior: revisar." }),
  rule({ rule_key: "SIN_TRAT", priority: 5, fiscal_classification_id: C.SIN, action: "REVIEW" }),
];

const pf = { supplier_kind: "PERSONA_FISICA", fiscal_condition: "REGISTRADO", tax_residence: "DO", country_code: null, e_issuer: "NO" };
const pj = { ...pf, supplier_kind: "PERSONA_JURIDICA" };
function ctx(p: Partial<FiscalContext> = {}): FiscalContext {
  return { date: "2026-10-03", supplier: pf, serviceTypeId: "st", fiscalClassificationId: C.TEC, documentType: "B01", subtotal: 100000, itbis: 18000, total: 118000, ...p };
}

describe("motor fiscal", () => {
  it("PF registrada · servicio técnico (Ley 30-26): ISR 15 % sobre 20 % = 3 % y 100 % ITBIS", () => {
    const r = evaluateFiscal(ctx(), RULES);
    expect(r.status).toBe("APPLIED");
    expect(r.isrWithheld).toBe(3000);
    expect(r.itbisWithheld).toBe(18000);
    expect(r.totalWithheld).toBe(21000);
    expect(r.netPayable).toBe(97000);
    expect(r.rule?.version).toBe(2);
  });

  it("misma operación con fecha de junio usa la versión anterior (2 %)", () => {
    const r = evaluateFiscal(ctx({ date: "2026-06-15" }), RULES);
    expect(r.rule?.version).toBe(1);
    expect(r.isrWithheld).toBe(2000);
    expect(r.netPayable).toBe(98000);
  });

  it("PF registrada · servicio profesional: ISR 15 % + ITBIS 100 %", () => {
    const r = evaluateFiscal(ctx({ fiscalClassificationId: C.PRO }), RULES);
    expect(r.isrWithheld).toBe(15000);
    expect(r.itbisWithheld).toBe(18000);
    expect(r.netPayable).toBe(85000);
  });

  it("PF informal → revisión (no inventa retención)", () => {
    const r = evaluateFiscal(ctx({ supplier: { ...pf, fiscal_condition: "INFORMAL" } }), RULES);
    expect(r.status).toBe("REVIEW");
    expect(r.totalWithheld).toBe(0);
    expect(r.netPayable).toBe(118000);
  });

  it("RST → revisión", () => {
    expect(evaluateFiscal(ctx({ supplier: { ...pf, fiscal_condition: "RST" } }), RULES).status).toBe("REVIEW");
  });

  it("PJ registrada · servicio profesional sin e-CF: 30 % del ITBIS", () => {
    const r = evaluateFiscal(ctx({ supplier: pj, fiscalClassificationId: C.PRO }), RULES);
    expect(r.itbisWithheld).toBe(5400);
    expect(r.isrWithheld).toBe(0);
    expect(r.netPayable).toBe(112600);
  });

  it("PJ emisora e-CF con E31: la regla de mayor prioridad elimina la retención", () => {
    const r = evaluateFiscal(
      ctx({ supplier: { ...pj, e_issuer: "SI" }, fiscalClassificationId: C.PRO, documentType: "E31" }),
      RULES,
    );
    expect(r.status).toBe("NO_RETENTION");
    expect(r.netPayable).toBe(118000);
  });

  it("PJ registrada · otro servicio → no corresponde retención (paga el total)", () => {
    const r = evaluateFiscal(ctx({ supplier: pj }), RULES);
    expect(r.status).toBe("NO_RETENTION");
    expect(r.message).toContain("No corresponde retención");
  });

  it("venta de bienes y servicio exento → sin retención", () => {
    expect(evaluateFiscal(ctx({ fiscalClassificationId: C.BIEN }), RULES).status).toBe("NO_RETENTION");
    expect(evaluateFiscal(ctx({ fiscalClassificationId: C.EXE }), RULES).status).toBe("NO_RETENTION");
  });

  it("proveedor extranjero → revisión aunque falten tipo y condición", () => {
    const r = evaluateFiscal(
      ctx({ supplier: { supplier_kind: null, fiscal_condition: null, tax_residence: "EXTRANJERO", country_code: "US", e_issuer: "NO" } }),
      RULES,
    );
    expect(r.status).toBe("REVIEW");
    expect(r.operationType).toBe("PAGO_EXTERIOR");
  });

  it("sin proveedor → no calcula y paga el total", () => {
    const r = evaluateFiscal(ctx({ supplier: null }), RULES);
    expect(r.status).toBe("NO_SUPPLIER");
    expect(r.netPayable).toBe(118000);
  });

  it("datos faltantes → dice exactamente qué falta", () => {
    const r = evaluateFiscal(ctx({ supplier: { ...pf, fiscal_condition: null } }), RULES);
    expect(r.status).toBe("MISSING_DATA");
    expect(r.message).toBe("Falta definir la condición fiscal del proveedor.");
    const r2 = evaluateFiscal(ctx({ fiscalClassificationId: null }), RULES);
    expect(r2.message).toBe("Este tipo de servicio todavía no tiene clasificación fiscal.");
  });

  it("sin regla vigente → NO_RULE con mensaje claro", () => {
    const r = evaluateFiscal(ctx({ fiscalClassificationId: C.SEG }), RULES);
    expect(r.status).toBe("NO_RULE");
    expect(r.message).toBe("No existe una regla vigente para esta combinación.");
  });

  it("regla vencida o futura no aplica", () => {
    const expired = rule({ rule_key: "X", valid_to: "2020-01-01", fiscal_classification_id: C.COM, action: "NO_RETENTION" });
    const future = rule({ rule_key: "Y", valid_from: "2030-01-01", fiscal_classification_id: C.COM, action: "NO_RETENTION" });
    expect(evaluateFiscal(ctx({ fiscalClassificationId: C.COM }), [expired, future]).status).toBe("NO_RULE");
    expect(ruleState(expired, "2026-10-03")).toBe("EXPIRED");
    expect(ruleState(future, "2026-10-03")).toBe("SCHEDULED");
    expect(ruleState({ ...future, is_active: false }, "2026-10-03")).toBe("INACTIVE");
  });

  it("dos reglas que coinciden con igual prioridad y distinto resultado → revisión", () => {
    const a = rule({ rule_key: "A", fiscal_classification_id: C.COM, isr_rate: 10 });
    const b = rule({ rule_key: "B", fiscal_classification_id: C.COM, isr_rate: 15 });
    const r = evaluateFiscal(ctx({ fiscalClassificationId: C.COM }), [a, b]);
    expect(r.status).toBe("REVIEW");
    expect(r.message).toContain("varias reglas");
  });

  it("regla inactiva no aplica", () => {
    const a = rule({ rule_key: "A", fiscal_classification_id: C.COM, is_active: false, action: "NO_RETENTION" });
    expect(evaluateFiscal(ctx({ fiscalClassificationId: C.COM }), [a]).status).toBe("NO_RULE");
  });

  it("redondea a 2 decimales y el neto nunca es negativo", () => {
    const r = evaluateFiscal(ctx({ subtotal: 333.33, itbis: 60, total: 393.33 }), RULES);
    expect(r.isrWithheld).toBe(10); // 333.33 × 20 % × 15 % = 9.9999
    expect(r.netPayable).toBe(323.33);
    const big = rule({ rule_key: "Z", fiscal_classification_id: C.COM, isr_rate: 100, itbis_retention_pct: 100 });
    expect(evaluateFiscal(ctx({ fiscalClassificationId: C.COM }), [big]).netPayable).toBe(0);
  });

  it("texto del tratamiento", () => {
    expect(describeTreatment({ action: "RETAIN", isr_rate: 15, isr_base_pct: 20, itbis_retention_pct: 100 })).toBe("ISR 15 % s/20 % · ITBIS 100 %");
    expect(describeTreatment({ action: "NO_RETENTION", isr_rate: 0, isr_base_pct: 100, itbis_retention_pct: 0 })).toBe("Sin retención");
  });
});
