"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/field";
import { InfoHint } from "@/components/ui/info-hint";

/**
 * Tipo de cuenta + "Permitir sobregiro" (reglas de la migración 063).
 * - Ahorros: el sobregiro queda apagado y bloqueado (nunca puede quedar en negativo).
 * - Corriente: sobregiro Sí/No (por defecto No).
 */
export function AccountKindFields({
  defaultKind = "",
  defaultOverdraft = false,
  allowEmpty = false,
}: {
  defaultKind?: string;
  defaultOverdraft?: boolean;
  /** Edición de cuentas viejas sin tipo: permite dejarlo "Sin indicar". */
  allowEmpty?: boolean;
}) {
  const [kind, setKind] = useState(defaultKind);
  const [overdraft, setOverdraft] = useState(defaultOverdraft);
  const isChecking = kind === "CHECKING";

  return (
    <>
      <Select
        label="Tipo de cuenta"
        name="account_kind"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
        required={!allowEmpty}
      >
        {allowEmpty ? (
          <option value="">Sin indicar (se trata como corriente sin sobregiro)</option>
        ) : (
          <option value="" disabled>
            Selecciona…
          </option>
        )}
        <option value="SAVINGS">Ahorros</option>
        <option value="CHECKING">Corriente</option>
      </Select>

      <div className="flex flex-col gap-1">
        <label
          className={`flex items-center gap-2 text-sm ${isChecking ? "text-brand-text" : "cursor-not-allowed text-brand-muted"}`}
        >
          <input
            type="checkbox"
            name="allow_overdraft"
            checked={isChecking && overdraft}
            disabled={!isChecking}
            onChange={(e) => setOverdraft(e.target.checked)}
          />
          Permitir sobregiro
        </label>
        <p className="text-xs text-brand-muted">
          {kind === "SAVINGS"
            ? "Las cuentas de ahorro no permiten sobregiro: nunca pueden quedar en negativo."
            : isChecking
              ? overdraft
                ? "El banco autoriza sobregiro: la cuenta puede quedar en negativo, pero el sistema te pedirá confirmar cada operación que lo genere."
                : "Sin sobregiro: no se podrá sacar más dinero del que hay en la cuenta."
              : "Solo aplica a cuentas corrientes."}
        </p>
      </div>
    </>
  );
}

/** Tarjetas: si el saldo a favor aumenta el poder de compra por encima del límite. */
export function CardFavorField({ defaultChecked = false }: { defaultChecked?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-sm text-brand-text">
        <input type="checkbox" name="favor_increases_limit" defaultChecked={defaultChecked} />
        El saldo a favor aumenta el crédito disponible por encima del límite
      </label>
      <p className="text-xs text-brand-muted">
        Márcalo solo si tu banco lo permite. Ej.: límite RD$2,000 y RD$1,000 a favor → puedes comprar
        hasta RD$3,000. Sin marcar, el disponible nunca pasa del límite.
      </p>
    </div>
  );
}

/**
 * Cuentas de banco: si la cuenta se ofrece en "Datos bancarios para el
 * pago" de facturas y cotizaciones, y el titular si no es la empresa.
 * Nunca aplica a tarjetas de crédito.
 */
export function InvoiceDisplayFields({
  defaultChecked = false,
  defaultHolder = "",
}: {
  defaultChecked?: boolean;
  defaultHolder?: string;
}) {
  const [show, setShow] = useState(defaultChecked);
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-brand-border bg-brand-background/60 p-3">
      <label className="flex items-center gap-2 text-sm text-brand-text">
        <input
          type="checkbox"
          name="show_on_invoices"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
        />
        Mostrar en facturas y cotizaciones
        <InfoHint text="La cuenta se podrá escoger en el recuadro DATOS BANCARIOS del PDF para que el cliente sepa dónde pagar. En cada factura se sugiere sola la cuenta en la moneda de la factura." />
      </label>
      {show && (
        <Input
          label="Titular (solo si no es la empresa)"
          name="holder_name"
          defaultValue={defaultHolder}
          placeholder="Vacío = nombre legal de la empresa"
          hint="Por defecto el PDF pone el nombre legal y el RNC de Configuración → Empresa."
        />
      )}
      {!show && defaultHolder && <input type="hidden" name="holder_name" value={defaultHolder} />}
    </div>
  );
}
