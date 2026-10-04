import { createClient } from "@/lib/supabase/server";
import type { FiscalRule } from "./engine";

export type FiscalRuleRow = FiscalRule & {
  tax_rate_id: string | null;
  required_document_type: string | null;
  report_tags: string[];
  notes: string | null;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  "id, rule_key, version, name, description, priority, is_active, valid_from, valid_to, supplier_kinds, fiscal_conditions, tax_residence, country_code, operation_type, fiscal_classification_id, document_types, e_issuer, action, isr_rate, isr_base_pct, itbis_retention_pct, tax_rate_id, required_document_type, report_tags, user_message, legal_source, legal_article, reference_url, notes, needs_review, last_reviewed_at, created_at, updated_at";

function normalize(r: Record<string, unknown>): FiscalRuleRow {
  return {
    ...(r as unknown as FiscalRuleRow),
    isr_rate: Number(r.isr_rate),
    isr_base_pct: Number(r.isr_base_pct),
    itbis_retention_pct: Number(r.itbis_retention_pct),
    report_tags: (r.report_tags as string[] | null) ?? [],
  };
}

/** Todas las reglas (todas las versiones) de la compañía. */
export async function listFiscalRules(): Promise<FiscalRuleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fiscal_rules")
    .select(COLUMNS)
    .order("priority")
    .order("rule_key")
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

export async function getFiscalRule(id: string): Promise<FiscalRuleRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("fiscal_rules").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalize(data as Record<string, unknown>) : null;
}

/**
 * ¿Algún gasto ya usó esta regla? (columna expenses.fiscal_rule_id, fase 5).
 * Si la columna todavía no existe, se considera no usada.
 */
export async function countRuleUsage(ruleId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("fiscal_rule_id", ruleId);
  if (error) return 0;
  return count ?? 0;
}
