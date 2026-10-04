"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { todayISO } from "@/lib/utils/dates";
import { fiscalRuleSchema, type FiscalRuleInput } from "./rule-schema";
import { countRuleUsage, getFiscalRule, listFiscalRules } from "./rule-queries";
import { evaluateFiscal, type FiscalResult } from "./engine";

/**
 * Reglas fiscales (migración 073). Solo Configuración (settings.manage).
 * Una regla ya usada por algún gasto NO se modifica: se crea una nueva
 * versión y la anterior se cierra el día antes (los gastos históricos
 * conservan su resultado). Todo queda en Auditoría.
 */

export type RuleActionState = { error: string | null; success?: string; successId?: number; id?: string };

async function companyId(): Promise<string> {
  const ids = await getCurrentUserCompanyIds();
  if (ids.length === 0) throw new Error("Tu usuario no está asignado a ninguna compañía.");
  return ids[0];
}

function revalidate(id?: string) {
  revalidatePath("/settings/fiscal-rules");
  if (id) revalidatePath(`/settings/fiscal-rules/${id}`);
}

function parse(formData: FormData) {
  const all = (k: string) => formData.getAll(k).map(String).filter(Boolean);
  return fiscalRuleSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    priority: formData.get("priority") ?? 50,
    is_active: formData.get("is_active") === "on",
    valid_from: String(formData.get("valid_from") ?? ""),
    valid_to: String(formData.get("valid_to") ?? ""),
    supplier_kinds: all("supplier_kinds"),
    fiscal_conditions: all("fiscal_conditions"),
    tax_residence: String(formData.get("tax_residence") ?? ""),
    country_code: String(formData.get("country_code") ?? ""),
    fiscal_classification_id: String(formData.get("fiscal_classification_id") ?? ""),
    document_types: all("document_types"),
    e_issuer: String(formData.get("e_issuer") ?? ""),
    action: String(formData.get("action") ?? "RETAIN"),
    isr_rate: formData.get("isr_rate") || 0,
    isr_base_pct: formData.get("isr_base_pct") || 100,
    itbis_retention_pct: formData.get("itbis_retention_pct") || 0,
    report_tags: all("report_tags"),
    user_message: String(formData.get("user_message") ?? ""),
    legal_source: String(formData.get("legal_source") ?? ""),
    legal_article: String(formData.get("legal_article") ?? ""),
    reference_url: String(formData.get("reference_url") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
}

function toRow(d: FiscalRuleInput) {
  const retain = d.action === "RETAIN";
  return {
    name: d.name,
    description: d.description || null,
    priority: d.priority,
    is_active: d.is_active,
    valid_from: d.valid_from,
    valid_to: d.valid_to || null,
    supplier_kinds: d.supplier_kinds.length ? d.supplier_kinds : null,
    fiscal_conditions: d.fiscal_conditions.length ? d.fiscal_conditions : null,
    tax_residence: d.tax_residence || null,
    country_code: d.tax_residence === "EXTRANJERO" && d.country_code ? d.country_code : null,
    operation_type: d.tax_residence === "EXTRANJERO" ? "PAGO_EXTERIOR" : null,
    fiscal_classification_id: d.fiscal_classification_id || null,
    document_types: d.document_types.length ? d.document_types : null,
    e_issuer: d.e_issuer || null,
    action: d.action,
    isr_rate: retain ? d.isr_rate : 0,
    isr_base_pct: retain ? d.isr_base_pct : 100,
    itbis_retention_pct: retain ? d.itbis_retention_pct : 0,
    report_tags: d.report_tags,
    user_message: d.user_message || null,
    legal_source: d.legal_source || null,
    legal_article: d.legal_article || null,
    reference_url: d.reference_url || null,
    notes: d.notes || null,
  };
}

function keyFromName(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 50) || "REGLA"
  );
}

/** Aviso si otra regla vigente tiene las mismas condiciones y prioridad (se superponen). */
async function overlapWarning(row: ReturnType<typeof toRow>, excludeKey?: string): Promise<string | null> {
  const rules = await listFiscalRules();
  const same = (a: string[] | null, b: string[] | null) =>
    JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());
  const clash = rules.find(
    (r) =>
      r.rule_key !== excludeKey &&
      r.is_active &&
      r.priority === row.priority &&
      (!r.valid_to || r.valid_to >= row.valid_from) &&
      (!row.valid_to || r.valid_from <= row.valid_to) &&
      same(r.supplier_kinds, row.supplier_kinds) &&
      same(r.fiscal_conditions, row.fiscal_conditions) &&
      r.tax_residence === row.tax_residence &&
      r.fiscal_classification_id === row.fiscal_classification_id &&
      same(r.document_types, row.document_types) &&
      r.e_issuer === row.e_issuer,
  );
  return clash ? ` Ojo: se superpone con "${clash.name}" (mismas condiciones y prioridad); cambia la prioridad de una de las dos.` : null;
}

export async function createFiscalRuleAction(_prev: RuleActionState, formData: FormData): Promise<RuleActionState> {
  await requirePermission("settings.manage");
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const cid = await companyId();
  const supabase = await createClient();
  const row = toRow(parsed.data);
  let key = keyFromName(parsed.data.name);
  const { data: keys } = await supabase.from("fiscal_rules").select("rule_key").eq("company_id", cid);
  const used = new Set((keys ?? []).map((k) => k.rule_key));
  for (let i = 2; used.has(key); i++) key = `${keyFromName(parsed.data.name).slice(0, 46)}_${i}`;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("fiscal_rules")
    .insert({ company_id: cid, rule_key: key, version: 1, ...row, needs_review: true, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await logAudit({ companyId: cid, action: "CREATE", entityType: "fiscal_rule", entityId: data.id, newValues: { rule_key: key, ...row } });
  revalidate();
  const warn = await overlapWarning(row, key);
  return { error: null, success: `Regla "${parsed.data.name}" creada.${warn ?? ""}`, successId: Date.now(), id: data.id };
}

/**
 * Guardar cambios. Si ningún gasto la usó, se corrige en el lugar. Si ya se
 * usó, se crea una NUEVA VERSIÓN que empieza en la fecha "Vigente desde"
 * indicada (debe ser posterior a la de la versión actual) y la actual se
 * cierra el día anterior.
 */
export async function updateFiscalRuleAction(
  ruleId: string,
  _prev: RuleActionState,
  formData: FormData,
): Promise<RuleActionState> {
  await requirePermission("settings.manage");
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const current = await getFiscalRule(ruleId);
  if (!current) return { error: "No se encontró la regla." };
  const cid = await companyId();
  const supabase = await createClient();
  const row = toRow(parsed.data);
  const forceVersion = formData.get("as_new_version") === "on";
  const used = await countRuleUsage(ruleId);

  if (!forceVersion && used === 0) {
    const { error } = await supabase.from("fiscal_rules").update(row).eq("id", ruleId);
    if (error) return { error: error.message };
    await logAudit({
      companyId: cid,
      action: current.valid_from !== row.valid_from || current.valid_to !== row.valid_to ? "VALIDITY_CHANGE" : "UPDATE",
      entityType: "fiscal_rule",
      entityId: ruleId,
      oldValues: current,
      newValues: row,
    });
    revalidate(ruleId);
    const warn = await overlapWarning(row, current.rule_key);
    return { error: null, success: `Regla guardada.${warn ?? ""}`, successId: Date.now(), id: ruleId };
  }

  // Nueva versión
  if (row.valid_from <= current.valid_from) {
    return {
      error: `Esta regla ya se usó en ${used} gasto(s) o elegiste "nueva versión": la nueva versión debe empezar después del ${current.valid_from}. Cambia "Vigente desde".`,
    };
  }
  const { data: versions } = await supabase
    .from("fiscal_rules")
    .select("version")
    .eq("company_id", cid)
    .eq("rule_key", current.rule_key)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (versions?.[0]?.version ?? current.version) + 1;
  const dayBefore = new Date(`${row.valid_from}T00:00:00Z`);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  const closeOn = dayBefore.toISOString().slice(0, 10);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: created, error: insErr } = await supabase
    .from("fiscal_rules")
    .insert({
      company_id: cid,
      rule_key: current.rule_key,
      version: nextVersion,
      ...row,
      needs_review: true,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (insErr || !created) return { error: insErr?.message ?? "No se pudo crear la nueva versión." };
  const { error: closeErr } = await supabase.from("fiscal_rules").update({ valid_to: closeOn }).eq("id", ruleId);
  if (closeErr) return { error: closeErr.message };
  await logAudit({
    companyId: cid,
    action: "NEW_VERSION",
    entityType: "fiscal_rule",
    entityId: created.id,
    oldValues: { previous_id: ruleId, previous_version: current.version, closed_on: closeOn },
    newValues: { version: nextVersion, ...row },
  });
  revalidate(ruleId);
  return {
    error: null,
    success: `Se creó la versión ${nextVersion} (vigente desde ${row.valid_from}); la versión ${current.version} quedó cerrada el ${closeOn}.`,
    successId: Date.now(),
    id: created.id,
  };
}

export async function toggleFiscalRuleAction(ruleId: string): Promise<void> {
  await requirePermission("settings.manage");
  const current = await getFiscalRule(ruleId);
  if (!current) throw new Error("No se encontró la regla.");
  const supabase = await createClient();
  const { error } = await supabase.from("fiscal_rules").update({ is_active: !current.is_active }).eq("id", ruleId);
  if (error) throw new Error(error.message);
  await logAudit({
    companyId: await companyId(),
    action: current.is_active ? "DEACTIVATE" : "ACTIVATE",
    entityType: "fiscal_rule",
    entityId: ruleId,
  });
  revalidate(ruleId);
}

/** Marca la regla como revisada (ej. por el contador). */
export async function markFiscalRuleReviewedAction(ruleId: string): Promise<void> {
  await requirePermission("settings.manage");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("fiscal_rules")
    .update({ needs_review: false, last_reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null })
    .eq("id", ruleId);
  if (error) throw new Error(error.message);
  await logAudit({ companyId: await companyId(), action: "REVIEWED", entityType: "fiscal_rule", entityId: ruleId });
  revalidate(ruleId);
}

/** Borra una regla solo si ningún gasto la usó; si no, hay que desactivarla. */
export async function deleteFiscalRuleAction(ruleId: string): Promise<{ error: string | null }> {
  await requirePermission("settings.manage");
  const used = await countRuleUsage(ruleId);
  if (used > 0) return { error: `Esta regla ya se usó en ${used} gasto(s): desactívala en lugar de borrarla.` };
  const current = await getFiscalRule(ruleId);
  const supabase = await createClient();
  const { error } = await supabase.from("fiscal_rules").delete().eq("id", ruleId);
  if (error) return { error: error.message };
  await logAudit({ companyId: await companyId(), action: "DELETE", entityType: "fiscal_rule", entityId: ruleId, oldValues: current });
  revalidate();
  return { error: null };
}

export type RuleTestInput = {
  supplier_kind: string;
  fiscal_condition: string;
  tax_residence: string;
  e_issuer: string;
  fiscal_classification_id: string;
  document_type: string;
  date: string;
  subtotal: number;
  itbis_percent: number;
};

/** "Probar regla": simula una operación y devuelve qué regla gana y por qué. */
export async function testFiscalRulesAction(input: RuleTestInput): Promise<FiscalResult & { candidateNames: string[] }> {
  await requirePermission("settings.manage");
  const rules = await listFiscalRules();
  const subtotal = Math.max(0, Number(input.subtotal) || 0);
  const itbis = Math.round(subtotal * (Math.max(0, Number(input.itbis_percent) || 0) / 100) * 100) / 100;
  const res = evaluateFiscal(
    {
      date: input.date || todayISO(),
      supplier: {
        supplier_kind: input.supplier_kind || null,
        fiscal_condition: input.fiscal_condition || null,
        tax_residence: input.tax_residence || "DO",
        country_code: null,
        e_issuer: input.e_issuer || "NO_CONFIRMADO",
      },
      serviceTypeId: input.fiscal_classification_id ? "simulado" : null,
      fiscalClassificationId: input.fiscal_classification_id || null,
      documentType: input.document_type || null,
      subtotal,
      itbis,
      total: subtotal + itbis,
    },
    rules,
  );
  return { ...res, candidateNames: res.candidates.map((c) => `${c.name} (v${c.version}, prioridad ${c.priority})`) };
}
