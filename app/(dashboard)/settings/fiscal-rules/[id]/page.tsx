import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ExternalLink, Pencil, Power } from "lucide-react";
import { getFiscalRule, listFiscalRules, countRuleUsage } from "@/features/fiscal/rule-queries";
import { listFiscalClassifications } from "@/features/fiscal/classification-queries";
import { describeTreatment, ruleState } from "@/features/fiscal/engine";
import { DOCUMENT_TYPES, RULE_ACTION_LABELS, RULE_STATE_LABELS, RULE_STATE_TONE, describeConditions } from "@/features/fiscal/rule-schema";
import { markFiscalRuleReviewedAction, toggleFiscalRuleAction } from "@/features/fiscal/rule-actions";
import { E_ISSUER_LABELS, FISCAL_CONDITION_LABELS, SUPPLIER_KIND_LABELS } from "@/features/suppliers/fiscal";
import { formatDate, formatDateTime, todayISO } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ActionButton } from "@/components/ui/action-button";
import { DeleteRuleButton } from "@/components/fiscal/delete-rule-button";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-brand-border py-2.5 last:border-0 sm:grid-cols-3">
      <dt className="text-sm text-brand-muted">{label}</dt>
      <dd className="text-sm text-brand-text sm:col-span-2">{children}</dd>
    </div>
  );
}

const any = <span className="text-brand-muted">Cualquiera</span>;

export default async function FiscalRuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rule, all, classifications, used] = await Promise.all([
    getFiscalRule(id),
    listFiscalRules(),
    listFiscalClassifications(),
    countRuleUsage(id),
  ]);
  if (!rule) notFound();
  const today = todayISO();
  const state = ruleState(rule, today);
  const className = (cid: string) => classifications.find((c) => c.id === cid)?.name;
  const versions = all.filter((r) => r.rule_key === rule.rule_key).sort((a, b) => b.version - a.version);
  const exampleIsr = Math.round(100000 * (rule.isr_base_pct / 100) * (rule.isr_rate / 100) * 100) / 100;
  const exampleItbis = Math.round(18000 * (rule.itbis_retention_pct / 100) * 100) / 100;

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <Link href="/settings/fiscal-rules" className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text">
        <ArrowLeft size={14} /> Reglas fiscales
      </Link>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-brand-text">{rule.name}</h2>
              <Badge tone={RULE_STATE_TONE[state]}>{RULE_STATE_LABELS[state]}</Badge>
              <Badge tone="neutral">Versión {rule.version}</Badge>
              {rule.needs_review ? (
                <Badge tone="warning">Revisar con su contador</Badge>
              ) : (
                <Badge tone="success">Revisada{rule.last_reviewed_at ? ` ${formatDate(rule.last_reviewed_at.slice(0, 10))}` : ""}</Badge>
              )}
            </div>
            {rule.description && <p className="mt-1 text-sm text-brand-muted">{rule.description}</p>}
            <p className="mt-2 text-sm text-brand-text">
              <strong>{describeTreatment(rule)}</strong> · {describeConditions(rule, className)}
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              {used > 0 ? `Usada en ${used} gasto(s): al editarla se crea una nueva versión.` : "Aún no se ha usado en ningún gasto."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/settings/fiscal-rules/${rule.id}/edit`}>
              <Button size="sm" variant="outline" icon={<Pencil size={14} />} hint="Abre el asistente con los datos de esta regla. Si ya se usó, guarda una nueva versión.">
                Editar
              </Button>
            </Link>
            {rule.needs_review && (
              <ActionButton
                label="Marcar como revisada"
                icon={<CheckCircle2 size={14} />}
                hint="Úsalo cuando tu contador confirme que la regla está correcta."
                onAction={markFiscalRuleReviewedAction.bind(null, rule.id)}
                successMessage="Regla marcada como revisada."
              />
            )}
            <ActionButton
              label={rule.is_active ? "Desactivar" : "Activar"}
              icon={<Power size={14} />}
              hint={rule.is_active ? "Deja de aplicarse a los gastos nuevos. Los gastos ya registrados no cambian." : "Vuelve a aplicarse a los gastos nuevos dentro de su vigencia."}
              onAction={toggleFiscalRuleAction.bind(null, rule.id)}
            />
            {used === 0 && <DeleteRuleButton ruleId={rule.id} name={rule.name} />}
          </div>
        </div>
      </Card>

      {rule.action === "RETAIN" && (
        <Card>
          <p className="mb-1 text-sm font-semibold text-brand-text">Ejemplo</p>
          <p className="text-sm text-brand-muted">
            Factura de {formatMoney(100000)} + ITBIS {formatMoney(18000)} = {formatMoney(118000)} → ISR retenido {formatMoney(exampleIsr)} · ITBIS
            retenido {formatMoney(exampleItbis)} → <strong className="text-brand-text">el proveedor recibe {formatMoney(118000 - exampleIsr - exampleItbis)}</strong>. Lo
            retenido ({formatMoney(exampleIsr + exampleItbis)}) se le paga a la DGII.
          </p>
        </Card>
      )}

      <Card>
        <p className="mb-2 text-sm font-semibold text-brand-text">Condiciones</p>
        <dl>
          <Row label="Dónde paga impuestos">{rule.tax_residence === "EXTRANJERO" ? `Extranjero${rule.country_code ? ` (${rule.country_code})` : ""}` : rule.tax_residence === "DO" ? "República Dominicana" : any}</Row>
          <Row label="Tipo de proveedor">{rule.supplier_kinds?.length ? rule.supplier_kinds.map((k) => SUPPLIER_KIND_LABELS[k] ?? k).join(", ") : any}</Row>
          <Row label="Condición fiscal">{rule.fiscal_conditions?.length ? rule.fiscal_conditions.map((c) => FISCAL_CONDITION_LABELS[c] ?? c).join(", ") : any}</Row>
          <Row label="Clasificación del servicio">{rule.fiscal_classification_id ? className(rule.fiscal_classification_id) : any}</Row>
          <Row label="Comprobante">{rule.document_types?.length ? rule.document_types.map((d) => DOCUMENT_TYPES.find((x) => x.code === d)?.label ?? d).join(", ") : any}</Row>
          <Row label="Emisor e-CF">{rule.e_issuer ? E_ISSUER_LABELS[rule.e_issuer] : any}</Row>
        </dl>
      </Card>

      <Card>
        <p className="mb-2 text-sm font-semibold text-brand-text">Qué hace</p>
        <dl>
          <Row label="Acción">{RULE_ACTION_LABELS[rule.action]}</Row>
          {rule.action === "RETAIN" && (
            <>
              <Row label="ISR retenido">{`${rule.isr_rate} %${rule.isr_base_pct < 100 ? ` sobre una base del ${rule.isr_base_pct} % (= ${Math.round(rule.isr_rate * rule.isr_base_pct) / 100} % efectivo)` : ""}`}</Row>
              <Row label="ITBIS retenido">{`${rule.itbis_retention_pct} % del ITBIS de la factura`}</Row>
            </>
          )}
          <Row label="Mensaje al usuario">{rule.user_message ?? <span className="text-brand-muted">—</span>}</Row>
          <Row label="Prioridad">{rule.priority}</Row>
          <Row label="Reportes">{rule.report_tags.length ? rule.report_tags.join(", ") : "—"}</Row>
        </dl>
      </Card>

      <Card>
        <p className="mb-2 text-sm font-semibold text-brand-text">Vigencia y referencia</p>
        <dl>
          <Row label="Vigente">{`${rule.valid_from <= "2000-01-01" ? "Siempre" : `Desde ${formatDate(rule.valid_from)}`}${rule.valid_to ? ` hasta ${formatDate(rule.valid_to)}` : " (sin fecha de fin)"}`}</Row>
          <Row label="Fuente normativa">{rule.legal_source ?? "—"}</Row>
          <Row label="Norma / artículo">{rule.legal_article ?? "—"}</Row>
          <Row label="Referencia">
            {rule.reference_url ? (
              <a href={rule.reference_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-accent hover:underline">
                Ver referencia DGII <ExternalLink size={13} />
              </a>
            ) : (
              "—"
            )}
          </Row>
          <Row label="Notas">{rule.notes ? <span className="whitespace-pre-line">{rule.notes}</span> : "—"}</Row>
          <Row label="Última revisión">{rule.last_reviewed_at ? formatDateTime(rule.last_reviewed_at) : "Sin revisar"}</Row>
        </dl>
      </Card>

      {versions.length > 1 && (
        <Card padded={false}>
          <p className="border-b border-brand-border px-5 py-3 text-sm font-semibold text-brand-text">Versiones</p>
          <ul className="divide-y divide-brand-border">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                <Link href={`/settings/fiscal-rules/${v.id}`} className={v.id === rule.id ? "font-semibold text-brand-text" : "text-brand-accent hover:underline"}>
                  Versión {v.version}
                </Link>
                <span className="text-brand-muted">{describeTreatment(v)}</span>
                <span className="text-brand-muted">
                  {v.valid_from <= "2000-01-01" ? "Siempre" : formatDate(v.valid_from)} → {v.valid_to ? formatDate(v.valid_to) : "sin fin"}
                </span>
                <Badge tone={RULE_STATE_TONE[ruleState(v, today)]}>{RULE_STATE_LABELS[ruleState(v, today)]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
