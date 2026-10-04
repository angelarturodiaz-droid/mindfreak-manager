"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";
import { toast } from "@/components/ui/toaster";
import { formatMoney } from "@/lib/utils/money";
import { todayISO } from "@/lib/utils/dates";
import {
  createFiscalRuleAction,
  updateFiscalRuleAction,
  type RuleActionState,
} from "@/features/fiscal/rule-actions";
import { DOCUMENT_TYPES, REPORT_TAGS, RULE_ACTION_LABELS } from "@/features/fiscal/rule-schema";
import { COUNTRIES, FISCAL_CONDITIONS, FISCAL_CONDITION_LABELS, SUPPLIER_KINDS, SUPPLIER_KIND_LABELS } from "@/features/suppliers/fiscal";
import { FIELD_HINTS } from "@/lib/ui/field-hints";
import type { FiscalRuleRow } from "@/features/fiscal/rule-queries";

type Classification = { id: string; name: string; is_active: boolean };

const STEPS = [
  { title: "¿A quién aplica?", help: "Elige a qué proveedores aplica la regla. Si no marcas nada en un grupo, aplica a todos los de ese grupo." },
  { title: "¿Qué tipo de operación?", help: "Si la regla depende del comprobante que entrega el proveedor (por ejemplo, solo facturas electrónicas E31), márcalo. Si no, déjalo vacío." },
  { title: "¿Qué servicio?", help: "La clasificación fiscal del servicio (se asigna en Configuración → Tipos de servicio). Vacío = cualquier servicio." },
  { title: "¿Qué debe hacer el ERP?", help: "Lo que hará el sistema cuando la regla aplique. Retener significa que una parte del pago se le paga a la DGII en vez de al proveedor." },
  { title: "Vigencia", help: "Desde cuándo y hasta cuándo aplica. Si la DGII cambia una tasa, crea una nueva versión con la fecha nueva: los gastos anteriores no cambian." },
  { title: "Nombre y referencia DGII", help: "Un nombre fácil de reconocer y de dónde sale la regla (ley, norma, artículo, enlace), para que cualquiera pueda verificarla." },
];

function CheckGroup({
  name,
  options,
  defaults,
}: {
  name: string;
  options: { value: string; label: string }[];
  defaults: string[];
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {options.map((o) => (
        <label key={o.value} className="flex items-center gap-2 rounded-[var(--radius-md)] border border-brand-border px-3 py-2 text-sm text-brand-text has-[:checked]:border-brand-accent has-[:checked]:bg-brand-accent-light">
          <input type="checkbox" name={name} value={o.value} defaultChecked={defaults.includes(o.value)} className="h-4 w-4 accent-[var(--brand-accent)]" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function RuleWizard({
  rule,
  classifications,
  usedCount = 0,
}: {
  rule?: FiscalRuleRow | null;
  classifications: Classification[];
  usedCount?: number;
}) {
  const router = useRouter();
  const action = rule ? updateFiscalRuleAction.bind(null, rule.id) : createFiscalRuleAction;
  const [state, formAction, pending] = useActionState<RuleActionState, FormData>(action, { error: null });
  const [step, setStep] = useState(0);
  const [residence, setResidence] = useState(rule?.tax_residence ?? "DO");
  const [act, setAct] = useState<string>(rule?.action ?? "RETAIN");
  const [isr, setIsr] = useState(String(rule?.isr_rate ?? 0));
  const [base, setBase] = useState(String(rule?.isr_base_pct ?? 100));
  const [itbis, setItbis] = useState(String(rule?.itbis_retention_pct ?? 0));
  const [asNewVersion, setAsNewVersion] = useState(usedCount > 0);

  useEffect(() => {
    if (state.successId) {
      toast.success(state.success ?? "Regla guardada.");
      if (state.id) router.push(`/settings/fiscal-rules/${state.id}`);
    }
  }, [state.successId, state.success, state.id, router]);

  const example = useMemo(() => {
    const sub = 100000;
    const tax = 18000;
    const i = act === "RETAIN" ? Math.round(sub * (Number(base) / 100) * (Number(isr) / 100) * 100) / 100 : 0;
    const t = act === "RETAIN" ? Math.round(tax * (Number(itbis) / 100) * 100) / 100 : 0;
    return { sub, tax, i, t, net: sub + tax - i - t };
  }, [act, isr, base, itbis]);

  const last = step === STEPS.length - 1;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!last) {
          setStep((s) => s + 1);
          return;
        }
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="flex max-w-3xl flex-col gap-5"
    >
      <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-6" aria-label="Pasos">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={`flex w-full flex-col items-start gap-1 rounded-[var(--radius-md)] border px-2.5 py-2 text-left text-xs transition-colors ${
                i === step
                  ? "border-brand-accent bg-brand-accent-light text-brand-accent"
                  : i < step
                    ? "border-brand-success/40 bg-brand-success-bg text-brand-text"
                    : "border-brand-border text-brand-muted"
              }`}
              aria-current={i === step ? "step" : undefined}
            >
              <span className="font-semibold">Paso {i + 1}</span>
              <span className="leading-tight">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-5">
        <h2 className="text-lg font-semibold text-brand-text">
          Paso {step + 1}. {STEPS[step].title}
        </h2>
        <p className="mb-4 mt-1 text-sm text-brand-muted">{STEPS[step].help}</p>

        {/* Paso 1 */}
        <div className={step === 0 ? "flex flex-col gap-4" : "hidden"}>
          <Select label="¿Dónde paga impuestos el proveedor?" name="tax_residence" value={residence} onChange={(e) => setResidence(e.target.value)} info={FIELD_HINTS.taxResidence}>
            <option value="">Cualquiera</option>
            <option value="DO">República Dominicana</option>
            <option value="EXTRANJERO">En el extranjero (pago al exterior)</option>
          </Select>
          {residence === "EXTRANJERO" && (
            <Select label="País (opcional)" name="country_code" defaultValue={rule?.country_code ?? ""}>
              <option value="">Cualquier país</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-brand-text">
              Tipo de proveedor <InfoHint text={FIELD_HINTS.supplierKind} />
            </p>
            <CheckGroup name="supplier_kinds" options={SUPPLIER_KINDS.map((k) => ({ value: k, label: SUPPLIER_KIND_LABELS[k] }))} defaults={rule?.supplier_kinds ?? []} />
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-brand-text">
              Condición fiscal <InfoHint text={FIELD_HINTS.fiscalCondition} />
            </p>
            <CheckGroup name="fiscal_conditions" options={FISCAL_CONDITIONS.map((c) => ({ value: c, label: FISCAL_CONDITION_LABELS[c] }))} defaults={rule?.fiscal_conditions ?? []} />
          </div>
          <Select label="¿Emite factura electrónica (e-CF)?" name="e_issuer" defaultValue={rule?.e_issuer ?? ""} info={FIELD_HINTS.eIssuer}>
            <option value="">No importa</option>
            <option value="SI">Solo si emite e-CF</option>
            <option value="NO">Solo si NO emite e-CF</option>
            <option value="NO_CONFIRMADO">Solo si no está confirmado</option>
          </Select>
        </div>

        {/* Paso 2 */}
        <div className={step === 1 ? "flex flex-col gap-3" : "hidden"}>
          <p className="flex items-center gap-1.5 text-sm font-medium text-brand-text">
            Tipo de comprobante <InfoHint text={FIELD_HINTS.documentType} />
          </p>
          <CheckGroup name="document_types" options={DOCUMENT_TYPES.map((d) => ({ value: d.code, label: d.label }))} defaults={rule?.document_types ?? []} />
          <p className="text-xs text-brand-muted">
            Compra local o pago al exterior se deduce solo de dónde paga impuestos el proveedor (paso 1).
          </p>
        </div>

        {/* Paso 3 */}
        <div className={step === 2 ? "flex flex-col gap-3" : "hidden"}>
          <Select label="Clasificación fiscal del servicio" name="fiscal_classification_id" defaultValue={rule?.fiscal_classification_id ?? ""} info={FIELD_HINTS.fiscalClassification}>
            <option value="">Cualquier servicio</option>
            {classifications
              .filter((c) => c.is_active || c.id === rule?.fiscal_classification_id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </div>

        {/* Paso 4 */}
        <div className={step === 3 ? "flex flex-col gap-4" : "hidden"}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Object.entries(RULE_ACTION_LABELS).map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-md)] border border-brand-border px-3 py-2.5 text-sm has-[:checked]:border-brand-accent has-[:checked]:bg-brand-accent-light">
                <input type="radio" name="action" value={value} checked={act === value} onChange={() => setAct(value)} className="mt-0.5 accent-[var(--brand-accent)]" />
                <span className="text-brand-text">{label}</span>
              </label>
            ))}
          </div>
          {act === "RETAIN" && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input label="ISR retenido (%)" name="isr_rate" type="number" step="0.01" min="0" max="100" value={isr} onChange={(e) => setIsr(e.target.value)} info={FIELD_HINTS.isrWithheld} />
                <Input
                  label="Base del ISR (%)"
                  name="isr_base_pct"
                  type="number"
                  step="0.01"
                  min="1"
                  max="100"
                  value={base}
                  onChange={(e) => setBase(e.target.value)}
                  info="Sobre qué parte del monto se calcula el ISR. Normalmente 100 %. Para servicios técnicos de personas físicas la DGII usa una base del 20 % (15 % × 20 % = 3 % efectivo)."
                />
                <Input label="ITBIS retenido (%)" name="itbis_retention_pct" type="number" step="0.01" min="0" max="100" value={itbis} onChange={(e) => setItbis(e.target.value)} info={FIELD_HINTS.itbisWithheld} />
              </div>
              <div className="rounded-[var(--radius-md)] bg-brand-background px-4 py-3 text-sm">
                <p className="mb-1 font-medium text-brand-text">Ejemplo con una factura de {formatMoney(example.sub)} + ITBIS {formatMoney(example.tax)}:</p>
                <p className="text-brand-muted">
                  ISR retenido {formatMoney(example.i)} · ITBIS retenido {formatMoney(example.t)} →{" "}
                  <strong className="text-brand-text">le pagas al proveedor {formatMoney(example.net)}</strong>
                </p>
              </div>
            </>
          )}
          {act !== "RETAIN" && (
            <>
              <input type="hidden" name="isr_rate" value="0" />
              <input type="hidden" name="isr_base_pct" value="100" />
              <input type="hidden" name="itbis_retention_pct" value="0" />
            </>
          )}
          <Textarea
            label="Mensaje para el usuario (opcional)"
            name="user_message"
            rows={2}
            defaultValue={rule?.user_message ?? ""}
            hint="Se muestra en el gasto cuando aplica esta regla. Ej. “Pago al exterior: confirma las retenciones con tu contador”."
          />
          <div>
            <p className="mb-1.5 text-sm font-medium text-brand-text">Reportes DGII donde se incluye (para el futuro)</p>
            <CheckGroup name="report_tags" options={REPORT_TAGS.map((t) => ({ value: t, label: t }))} defaults={rule?.report_tags ?? ["606"]} />
          </div>
          <Input
            label="Prioridad"
            name="priority"
            type="number"
            min="1"
            max="999"
            defaultValue={rule?.priority ?? 50}
            info="Si varias reglas aplican, gana la de número más bajo. Usa un número bajo (ej. 10) para excepciones y uno alto (ej. 90) para reglas generales."
          />
        </div>

        {/* Paso 5 */}
        <div className={step === 4 ? "flex flex-col gap-4" : "hidden"}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Vigente desde" name="valid_from" type="date" required defaultValue={rule?.valid_from ?? todayISO()} />
            <Input label="Vigente hasta (opcional)" name="valid_to" type="date" defaultValue={rule?.valid_to ?? ""} hint="Vacío = sin fecha de fin." />
          </div>
          <label className="flex items-center gap-2 text-sm text-brand-text">
            <input type="checkbox" name="is_active" defaultChecked={rule?.is_active ?? true} className="h-4 w-4 accent-[var(--brand-accent)]" />
            Activa
          </label>
          {rule && (
            <label className="flex items-start gap-2 rounded-[var(--radius-md)] border border-brand-border px-3 py-2.5 text-sm text-brand-text">
              <input
                type="checkbox"
                name="as_new_version"
                checked={asNewVersion}
                disabled={usedCount > 0}
                onChange={(e) => setAsNewVersion(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--brand-accent)]"
              />
              <span>
                Guardar como <strong>nueva versión</strong> (la actual se cierra el día antes de la nueva fecha).
                {usedCount > 0 && (
                  <span className="block text-xs text-brand-muted">
                    Obligatorio: esta regla ya se usó en {usedCount} gasto(s) y su historial no se puede cambiar.
                  </span>
                )}
              </span>
            </label>
          )}
          {usedCount > 0 && <input type="hidden" name="as_new_version" value="on" />}
        </div>

        {/* Paso 6 */}
        <div className={step === 5 ? "flex flex-col gap-4" : "hidden"}>
          <Input label="Nombre de la regla" name="name" required defaultValue={rule?.name ?? ""} placeholder="Ej. Persona Física – Servicios técnicos" />
          <Textarea label="Descripción (opcional)" name="description" rows={2} defaultValue={rule?.description ?? ""} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Fuente normativa" name="legal_source" defaultValue={rule?.legal_source ?? ""} placeholder="Ej. Ley 30-26 · Norma General 07-2007" />
            <Input label="Norma / artículo" name="legal_article" defaultValue={rule?.legal_article ?? ""} placeholder="Ej. Art. 309 Código Tributario" />
          </div>
          <Input label="Enlace de referencia (opcional)" name="reference_url" type="url" defaultValue={rule?.reference_url ?? ""} placeholder="https://dgii.gov.do/…" />
          <Textarea label="Notas (opcional)" name="notes" rows={3} defaultValue={rule?.notes ?? ""} hint="Ej. “Confirmado por el contador el 10-oct”." />
        </div>
      </div>

      {state.error && <p className="rounded-[var(--radius-md)] bg-brand-danger-bg px-3 py-2 text-sm text-brand-danger">{state.error}</p>}

      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="outline" icon={<ArrowLeft size={14} />} disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Anterior
        </Button>
        {last ? (
          <Button type="submit" loading={pending} icon={<Check size={14} />}>
            {rule ? "Guardar regla" : "Crear regla"}
          </Button>
        ) : (
          <Button type="submit" icon={<ArrowRight size={14} />}>
            Siguiente
          </Button>
        )}
      </div>
    </form>
  );
}
