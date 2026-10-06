"use client";

import { useEffect, useRef, useState } from "react";
import { Scale } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { SearchSelect } from "@/components/ui/search-select";
import { Badge } from "@/components/ui/badge";
import { InfoHint } from "@/components/ui/info-hint";
import { FIELD_HINTS } from "@/lib/ui/field-hints";
import { DOCUMENT_TYPES } from "@/features/fiscal/rule-schema";
import { previewExpenseFiscalAction } from "@/features/expenses/actions";
import type { ExpenseFiscalPreview } from "@/features/fiscal/expense-fiscal";
import { EXPENSE_FISCAL_STATUS_LABELS, EXPENSE_FISCAL_STATUS_TONE } from "@/features/fiscal/expense-labels";
import { FiscalBreakdown } from "./fiscal-breakdown";
import { FiscalExplanation } from "./fiscal-explanation";

type ServiceType = { id: string; name: string; category_id: string; fiscal_classification_id: string | null };
type SupplierRef = { id: string; service_type_id?: string | null };

/**
 * Campos fiscales del gasto (tipo de servicio, comprobante, NCF) y la
 * tarjeta "Tratamiento fiscal", que se actualiza sola mientras se llena el
 * formulario. El cálculo lo hace el servidor (previewExpenseFiscalAction)
 * con el motor fiscal; al guardar se vuelve a calcular allí.
 *
 * Escucha los cambios del <form> que la contiene (proveedor, fecha,
 * subtotal, impuesto, moneda), así no hay que cambiar el resto del formulario.
 */
export function ExpenseFiscalFields({
  serviceTypes,
  categories,
  suppliers,
  defaults,
  canSeeRules = false,
  onPreview,
}: {
  serviceTypes: ServiceType[];
  categories: { id: string; name: string }[];
  suppliers: SupplierRef[];
  defaults?: { serviceTypeId?: string | null; documentType?: string | null; ncf?: string | null; supplierId?: string | null };
  canSeeRules?: boolean;
  /** Avisa el neto a pagar y la moneda calculados (ej. para el pago en moneda diferente). */
  onPreview?: (info: { netPayable: number; currency: string } | null) => void;
}) {
  const onPreviewRef = useRef(onPreview);
  useEffect(() => {
    onPreviewRef.current = onPreview;
  }, [onPreview]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const touchedRef = useRef(Boolean(defaults?.serviceTypeId));
  const initialType =
    defaults?.serviceTypeId ?? suppliers.find((s) => s.id === defaults?.supplierId)?.service_type_id ?? "";
  const [serviceTypeId, setServiceTypeId] = useState(initialType);
  const [suggested, setSuggested] = useState(Boolean(!defaults?.serviceTypeId && initialType));
  const [preview, setPreview] = useState<ExpenseFiscalPreview | null>(null);
  const [currency, setCurrency] = useState("DOP");
  const [supplierId, setSupplierId] = useState(defaults?.supplierId ?? "");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const form = wrapperRef.current?.closest("form");
    if (!form) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request = 0;
    let lastSupplier = String(new FormData(form).get("supplier_id") ?? "");

    const run = async () => {
      const fd = new FormData(form);
      const sup = String(fd.get("supplier_id") ?? "");
      let type = String(fd.get("service_type_id") ?? "");
      // Al cambiar de proveedor se sugiere su tipo de servicio, salvo que el
      // usuario ya haya elegido uno a mano.
      if (sup !== lastSupplier) {
        lastSupplier = sup;
        if (!touchedRef.current) {
          type = suppliers.find((s) => s.id === sup)?.service_type_id ?? "";
          setServiceTypeId(type);
          setSuggested(Boolean(type));
        }
      }
      setSupplierId(sup);
      const formCurrency = String(fd.get("currency") ?? "DOP") || "DOP";
      setCurrency(formCurrency);
      const id = ++request;
      setLoading(true);
      try {
        const res = await previewExpenseFiscalAction({
          supplierId: sup,
          serviceTypeId: type,
          documentType: String(fd.get("document_type") ?? ""),
          date: String(fd.get("expense_date") ?? ""),
          subtotal: Number(fd.get("subtotal") ?? 0),
          taxPercent: Number(fd.get("tax_percent") ?? 0),
        });
        if (id === request) {
          setPreview(res);
          setFailed(false);
          onPreviewRef.current?.({ netPayable: res.netPayable, currency: formCurrency });
        }
      } catch {
        if (id === request) setFailed(true);
      } finally {
        if (id === request) setLoading(false);
      }
    };
    // Se espera un momento: los montos se pasan al <input> oculto después
    // de escribir, y así no se calcula en cada tecla.
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(run, 450);
    };
    schedule();
    form.addEventListener("input", schedule);
    form.addEventListener("change", schedule);
    form.addEventListener("reset", schedule);
    // Volver a esta pestaña (ej. después de completar la ficha del proveedor).
    window.addEventListener("focus", schedule);
    return () => {
      clearTimeout(timer);
      form.removeEventListener("input", schedule);
      form.removeEventListener("change", schedule);
      form.removeEventListener("reset", schedule);
      window.removeEventListener("focus", schedule);
    };
  }, [suppliers]);

  const byCategory = categories
    .map((c) => ({ ...c, types: serviceTypes.filter((t) => t.category_id === c.id) }))
    .filter((c) => c.types.length > 0);

  return (
    <div ref={wrapperRef} className="flex flex-col gap-4">
      <SearchSelect
        label="Tipo de servicio"
        name="service_type_id"
        value={serviceTypeId}
        info={FIELD_HINTS.expenseServiceType}
        hint={suggested ? "Sugerido por el proveedor. Cámbialo si este gasto es de otro tipo." : undefined}
        placeholder="Busca el servicio o su categoría…"
        onChange={(v) => {
          touchedRef.current = true;
          setServiceTypeId(v);
          setSuggested(false);
        }}
        options={byCategory.flatMap((c) =>
          c.types.map((t) => ({ value: t.id, label: t.name, group: c.name })),
        )}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="Tipo de comprobante" name="document_type" defaultValue={defaults?.documentType ?? ""} info={FIELD_HINTS.documentType}>
          <option value="">Sin especificar</option>
          {DOCUMENT_TYPES.map((d) => (
            <option key={d.code} value={d.code}>
              {d.label}
            </option>
          ))}
        </Select>
        <Input
          label="NCF (opcional)"
          name="ncf"
          defaultValue={defaults?.ncf ?? ""}
          placeholder="B0100000123"
          maxLength={13}
          info={FIELD_HINTS.ncf}
          className="uppercase"
        />
      </div>

      <section
        aria-live="polite"
        className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-brand-text">
            <Scale size={16} className="text-brand-accent" aria-hidden />
            Tratamiento fiscal
            <InfoHint text={FIELD_HINTS.fiscalTreatment} label="Qué es el tratamiento fiscal" />
          </h3>
          {preview && (
            <Badge tone={EXPENSE_FISCAL_STATUS_TONE[preview.status]}>
              {loading ? "Calculando…" : EXPENSE_FISCAL_STATUS_LABELS[preview.status]}
            </Badge>
          )}
        </div>
        {failed && <p className="text-sm text-brand-danger">No se pudo calcular ahora. Al guardar se calcula de nuevo.</p>}
        {!preview && !failed && <p className="text-sm text-brand-muted">Calculando…</p>}
        {preview && (
          <>
            <FiscalExplanation
              status={preview.status}
              message={preview.message}
              explanation={preview.explanation}
              missing={preview.missing}
              rule={
                preview.rule
                  ? {
                      id: preview.rule.id,
                      name: preview.rule.name,
                      version: preview.rule.version,
                      treatment: preview.treatment,
                      legal_source: preview.rule.legal_source,
                      legal_article: preview.rule.legal_article,
                      reference_url: preview.rule.reference_url,
                      needs_review: preview.rule.needs_review,
                    }
                  : null
              }
              supplierId={supplierId}
              canSeeRules={canSeeRules}
            />
            {preview.status !== "BLOCKED" && (
              <FiscalBreakdown
                currency={currency}
                amounts={{
                  total: preview.netPayable + preview.totalWithheld,
                  isrRate: preview.isrRate,
                  isrBasePct: preview.isrBasePct,
                  itbisRetentionPct: preview.itbisRetentionPct,
                  isrWithheld: preview.isrWithheld,
                  itbisWithheld: preview.itbisWithheld,
                  totalWithheld: preview.totalWithheld,
                  netPayable: preview.netPayable,
                }}
              />
            )}
            {preview.status === "BLOCKED" && (
              <p className="text-sm text-brand-danger">Así como está, el gasto no se podrá guardar.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
