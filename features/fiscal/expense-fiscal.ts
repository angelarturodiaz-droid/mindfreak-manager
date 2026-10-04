import { createClient } from "@/lib/supabase/server";
import { evaluateFiscal, describeTreatment, type FiscalResult } from "./engine";
import { listFiscalRules } from "./rule-queries";

/**
 * Tratamiento fiscal de un gasto (fase 5 de claude/propuesta-tratamiento-fiscal.md).
 * Lee proveedor, tipo de servicio y reglas, llama al motor puro y arma las
 * columnas que se guardan en el gasto ("snapshot"). El navegador nunca
 * decide los montos: la vista previa y el guardado pasan por aquí.
 */

export type ExpenseFiscalInput = {
  supplierId: string | null;
  serviceTypeId: string | null;
  documentType: string | null;
  ncf: string | null;
  date: string;
  subtotal: number;
  tax: number;
  total: number;
};

export type ExpenseFiscalPreview = FiscalResult & {
  serviceTypeName: string | null;
  classificationName: string | null;
  treatment: string | null;
};

export async function evaluateExpenseFiscal(input: ExpenseFiscalInput): Promise<ExpenseFiscalPreview> {
  const supabase = await createClient();
  const [supplierRes, typeRes, rules] = await Promise.all([
    input.supplierId
      ? supabase
          .from("suppliers")
          .select("name, supplier_kind, fiscal_condition, tax_residence, country_code, e_issuer")
          .eq("id", input.supplierId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    input.serviceTypeId
      ? supabase
          .from("supplier_service_types")
          .select("name, fiscal_classification_id, fiscal_classifications(name)")
          .eq("id", input.serviceTypeId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    listFiscalRules(),
  ]);
  if (supplierRes.error) throw new Error(supplierRes.error.message);
  if (typeRes.error) throw new Error(typeRes.error.message);

  const type = typeRes.data as
    | { name: string; fiscal_classification_id: string | null; fiscal_classifications: { name: string } | { name: string }[] | null }
    | null;
  const cls = type?.fiscal_classifications;
  const classificationName = (Array.isArray(cls) ? cls[0]?.name : cls?.name) ?? null;

  const res = evaluateFiscal(
    {
      date: input.date,
      supplier: supplierRes.data ?? null,
      serviceTypeId: type ? input.serviceTypeId : null,
      fiscalClassificationId: type?.fiscal_classification_id ?? null,
      documentType: input.documentType,
      subtotal: input.subtotal,
      itbis: input.tax,
      total: input.total,
    },
    rules,
  );
  return {
    ...res,
    serviceTypeName: type?.name ?? null,
    classificationName,
    treatment: res.rule ? describeTreatment(res.rule) : null,
  };
}

/** Columnas del gasto (y p_fiscal de create_card_expense: mismas claves + snapshot). */
export function fiscalColumns(input: ExpenseFiscalInput, res: ExpenseFiscalPreview) {
  return {
    service_type_id: input.serviceTypeId,
    document_type: input.documentType,
    ncf: input.ncf,
    operation_type: res.operationType,
    fiscal_status: res.status,
    fiscal_rule_id: res.rule?.id ?? null,
    fiscal_rule_version: res.rule?.version ?? null,
    isr_rate: res.isrRate,
    isr_base_pct: res.isrBasePct,
    itbis_retention_pct: res.itbisRetentionPct,
    isr_withheld: res.isrWithheld,
    itbis_withheld: res.itbisWithheld,
    total_withheld: res.totalWithheld,
    net_payable: res.netPayable,
    fiscal_evaluated_at: new Date().toISOString(),
    fiscal_snapshot: {
      status: res.status,
      message: res.message,
      explanation: res.explanation,
      missing: res.missing,
      rule: res.rule
        ? {
            id: res.rule.id,
            rule_key: res.rule.rule_key,
            version: res.rule.version,
            name: res.rule.name,
            treatment: res.treatment,
            legal_source: res.rule.legal_source,
            legal_article: res.rule.legal_article,
            reference_url: res.rule.reference_url,
            needs_review: res.rule.needs_review,
          }
        : null,
      service_type: res.serviceTypeName,
      classification: res.classificationName,
      amounts: { subtotal: input.subtotal, itbis: input.tax, total: input.total },
      evaluated_on: input.date,
    },
  };
}

