import Link from "next/link";
import { Plus, Scale, TriangleAlert } from "lucide-react";
import { listFiscalRules } from "@/features/fiscal/rule-queries";
import { listFiscalClassifications } from "@/features/fiscal/classification-queries";
import { describeTreatment, ruleState } from "@/features/fiscal/engine";
import { RULE_STATE_LABELS, RULE_STATE_TONE, describeConditions } from "@/features/fiscal/rule-schema";
import { SUPPLIER_KINDS, SUPPLIER_KIND_LABELS } from "@/features/suppliers/fiscal";
import { todayISO, formatDate } from "@/lib/utils/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { InfoHint } from "@/components/ui/info-hint";
import { RuleTester } from "@/components/fiscal/rule-tester";

/**
 * Configuración → Reglas fiscales. Vista sencilla (nombre, a quién aplica,
 * tratamiento, vigencia, estado); el detalle técnico se ve al abrir una regla.
 */
export default async function FiscalRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; class?: string; state?: string }>;
}) {
  const params = await searchParams;
  const [rules, classifications] = await Promise.all([listFiscalRules(), listFiscalClassifications()]);
  const today = todayISO();
  const className = (id: string) => classifications.find((c) => c.id === id)?.name;
  const withState = rules.map((r) => ({ ...r, state: ruleState(r, today) }));
  const counts = { ACTIVE: 0, SCHEDULED: 0, EXPIRED: 0, INACTIVE: 0 } as Record<string, number>;
  for (const r of withState) counts[r.state]++;
  const toReview = withState.filter((r) => r.needs_review && r.state !== "EXPIRED").length;

  const filtered = withState.filter(
    (r) =>
      (!params.kind || !r.supplier_kinds?.length || r.supplier_kinds.includes(params.kind)) &&
      (!params.class || r.fiscal_classification_id === params.class) &&
      (!params.state || r.state === params.state),
  );
  const hasFilters = Boolean(params.kind || params.class || params.state);

  const columns: Column<(typeof withState)[number]>[] = [
    {
      header: "Nombre",
      accessor: (r) => (
        <div className="flex flex-col gap-1">
          <Link href={`/settings/fiscal-rules/${r.id}`} className="font-medium text-brand-text hover:text-brand-accent">
            {r.name}
            {r.version > 1 && <span className="ml-1.5 text-xs font-normal text-brand-muted">v{r.version}</span>}
          </Link>
          {r.needs_review && r.state !== "EXPIRED" && (
            <span className="w-fit">
              <Badge tone="warning">Revisar con su contador</Badge>
            </span>
          )}
        </div>
      ),
    },
    { header: "Aplica a", accessor: (r) => <span className="text-sm text-brand-muted">{describeConditions(r, className)}</span> },
    { header: "Tratamiento", accessor: (r) => <span className="whitespace-nowrap text-sm font-medium text-brand-text">{describeTreatment(r)}</span> },
    {
      header: "Vigencia",
      accessor: (r) => (
        <span className="whitespace-nowrap text-sm text-brand-muted">
          {r.valid_from <= "2000-01-01" ? "Siempre" : `Desde ${formatDate(r.valid_from)}`}
          {r.valid_to ? ` hasta ${formatDate(r.valid_to)}` : ""}
        </span>
      ),
    },
    { header: "Estado", accessor: (r) => <Badge tone={RULE_STATE_TONE[r.state]}>{RULE_STATE_LABELS[r.state]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-primary">
            <Scale size={18} aria-hidden /> Reglas fiscales de proveedores
          </h2>
          <p className="text-sm text-brand-muted">
            Aquí vive todo lo que decide las <strong>retenciones</strong> al pagar a un proveedor: a quién aplica, qué servicio,
            cuánto retener y desde cuándo. Cuando registres un gasto, el sistema busca la regla vigente y te explica el
            resultado. No hace falta saber de impuestos para registrar gastos: la complejidad vive aquí.
          </p>
        </div>
        <Link href="/settings/fiscal-rules/new">
          <Button icon={<Plus size={14} />} hint="Abre el asistente de 6 pasos para crear una regla.">
            Nueva regla
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-brand-text">
          {counts.ACTIVE} vigentes · {counts.SCHEDULED} programadas · {counts.EXPIRED} vencidas · {counts.INACTIVE} inactivas
        </span>
        {toReview > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-brand-warning-bg px-2.5 py-1 text-brand-text">
            <TriangleAlert size={14} className="text-brand-warning" aria-hidden />
            {toReview} por revisar con su contador
            <InfoHint text="Las reglas iniciales se cargaron como propuesta basada en fuentes públicas de la DGII. Ábrelas, compáralas con tu contador y pulsa 'Marcar como revisada'. Las dudosas están inactivas." />
          </span>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <form action="/settings/fiscal-rules" method="get" className="flex flex-wrap items-center gap-2">
          <AutoSubmitSelect name="kind" defaultValue={params.kind ?? ""} className="w-52" aria-label="Filtrar por tipo de proveedor">
            <option value="">Todo tipo de proveedor</option>
            {SUPPLIER_KINDS.map((k) => (
              <option key={k} value={k}>
                {SUPPLIER_KIND_LABELS[k]}
              </option>
            ))}
          </AutoSubmitSelect>
          <AutoSubmitSelect name="class" defaultValue={params.class ?? ""} className="w-56" aria-label="Filtrar por clasificación fiscal">
            <option value="">Toda clasificación</option>
            {classifications.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </AutoSubmitSelect>
          <AutoSubmitSelect name="state" defaultValue={params.state ?? ""} className="w-44" aria-label="Filtrar por estado">
            <option value="">Todo estado</option>
            {Object.entries(RULE_STATE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </AutoSubmitSelect>
          {hasFilters && (
            <Link href="/settings/fiscal-rules" className="px-2 text-sm text-brand-accent hover:underline">
              Limpiar
            </Link>
          )}
          <span className="ml-auto text-sm text-brand-muted">{filtered.length} reglas</span>
        </form>
        <DataTable
          columns={columns}
          rows={filtered}
          keyFor={(r) => r.id}
          maxWidth="max-w-none"
          emptyMessage="Sin reglas todavía."
          filtered={hasFilters}
          clearHref="/settings/fiscal-rules"
          what="reglas"
        />
      </section>

      <Card className="flex flex-col gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 font-semibold text-brand-text">
            Probar reglas
            <InfoHint text="Simula un pago con los datos que elijas y te muestra qué regla aplicaría, cuánto se retendría y cuánto recibiría el proveedor. No guarda nada." />
          </h3>
          <p className="text-sm text-brand-muted">Útil para revisar las reglas con tu contador antes de usarlas.</p>
        </div>
        <RuleTester classifications={classifications} />
      </Card>
    </div>
  );
}
