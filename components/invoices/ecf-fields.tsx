"use client";

import { Input, Select, Textarea } from "@/components/ui/field";
import { ECF_FIELD_INFO, ECF_TYPES, INCOME_TYPES, PAYMENT_TYPES } from "@/lib/dgii/catalogs";

/**
 * Campos de la factura electrónica (e-CF) en el mismo orden del Facturador Gratuito DGII.
 * `withReceipt`: también los datos que devuelve el Facturador (e-NCF, código de seguridad, firma).
 */
export function EcfFields({
  defaults,
  withReceipt = false,
}: {
  defaults?: {
    ncf_type?: string | null;
    income_type?: string | null;
    payment_type_code?: string | null;
    ecf_comments?: string | null;
    e_ncf?: string | null;
    e_ncf_valid_until?: string | null;
    security_code?: string | null;
    digital_signature_at?: string | null;
  };
  withReceipt?: boolean;
}) {
  const d = defaults ?? {};
  const ecfType = d.ncf_type && /^\d{2}$/.test(d.ncf_type) ? d.ncf_type : "31";
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-brand-border bg-brand-background p-3">
      <p className="text-xs text-brand-muted">
        Datos para el <strong>Facturador Gratuito DGII</strong>, con su número del Facturador. Pasa el mouse por cada ⓘ para saber qué
        elegir.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select label="1 · Tipo de e-CF" name="ncf_type" defaultValue={ecfType} info={ECF_FIELD_INFO.ecfType}>
          {ECF_TYPES.map((t) => (
            <option key={t.value} value={t.value} title={t.info}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select label="3 · Tipo de pago" name="payment_type_code" defaultValue={d.payment_type_code ?? ""} info={ECF_FIELD_INFO.paymentType}>
          <option value="">Según la condición de pago</option>
          {PAYMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value} title={t.info}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select label="4 · Tipo de ingreso" name="income_type" defaultValue={d.income_type ?? "01"} info={ECF_FIELD_INFO.incomeType} className="sm:col-span-2">
          {INCOME_TYPES.map((t) => (
            <option key={t.value} value={t.value} title={t.info}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>
      <Textarea
        label="10 · Comentarios (opcional)"
        name="ecf_comments"
        rows={2}
        maxLength={250}
        defaultValue={d.ecf_comments ?? ""}
        placeholder="Ej. PROY-0026 · Evento corporativo · OC aprobada"
        info={ECF_FIELD_INFO.comments}
      />
      {withReceipt && (
        <div className="flex flex-col gap-2 border-t border-brand-border pt-3">
          <p className="text-xs font-medium text-brand-text">
            Al volver del Facturador <span className="font-normal text-brand-muted">(se puede dejar vacío y anotarlo después de emitir)</span>
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="e-NCF"
              name="e_ncf"
              defaultValue={d.e_ncf ?? ""}
              placeholder="Ej. E310000000371"
              info="El número que te da el Facturador al generar el e-CF: E + tipo (31, 32…) + 10 dígitos."
            />
            <Input label="Código de seguridad" name="security_code" defaultValue={d.security_code ?? ""} placeholder="Ej. A1B2C3" info="Los 6 caracteres que salen en el e-CF generado." />
            <Input
              label="Fecha y hora de firma"
              name="digital_signature_at"
              type="datetime-local"
              defaultValue={d.digital_signature_at ? d.digital_signature_at.slice(0, 16) : ""}
              info="La fecha de firma digital que muestra el e-CF."
            />
            <Input label="e-NCF válido hasta" name="e_ncf_valid_until" type="date" defaultValue={d.e_ncf_valid_until ?? ""} info="Vencimiento de la secuencia, si el Facturador lo indica." />
          </div>
        </div>
      )}
    </div>
  );
}
