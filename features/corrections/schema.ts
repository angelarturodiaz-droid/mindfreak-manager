/**
 * V1-4 — Correcciones de cobros, pagos y movimientos manuales con doble
 * aprobación. Textos en lenguaje sencillo (para personas no financieras).
 */

export type CorrectionTargetType = "customer_payment" | "supplier_payment" | "bank_transaction";
export type CorrectionAction = "CHANGE" | "VOID";
export type CorrectionStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";

export const TARGET_LABELS: Record<CorrectionTargetType, string> = {
  customer_payment: "Cobro",
  supplier_payment: "Pago a proveedor",
  bank_transaction: "Movimiento de banco",
};

export const STATUS_LABELS: Record<CorrectionStatus, string> = {
  PENDING: "Por aprobar",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  WITHDRAWN: "Retirada",
};

export const STATUS_TONES: Record<CorrectionStatus, "warning" | "success" | "danger" | "neutral"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
};

export const STATUS_INFO: Record<CorrectionStatus, string> = {
  PENDING: "Esperando que otra persona de Administración o Finanzas la revise. Todavía no cambió nada.",
  APPROVED: "Ya se aplicó: el registro quedó corregido (o anulado) y el banco ajustado.",
  REJECTED: "No se aplicó. Mira la nota de quien la rechazó.",
  WITHDRAWN: "Quien la pidió la retiró antes de que la decidieran. No cambió nada.",
};

export const FIELD_LABELS: Record<string, string> = {
  amount: "Monto",
  date: "Fecha",
  bank_account_id: "Cuenta",
  reference: "Referencia",
  description: "Descripción",
};

/** Qué explica el ⓘ del botón «Corregir». */
export const CORRECTION_INFO =
  "¿Algo se registró mal? Pide aquí la corrección (o la anulación). Otra persona de Administración o Finanzas la revisa y la aprueba; mientras tanto no cambia nada. Nada se borra: queda todo en la Auditoría.";

/** Explicación de lo que pasará al aprobarse, según lo que se pidió. */
export function whatWillHappen(
  targetType: CorrectionTargetType,
  action: CorrectionAction,
  changes: { amount?: boolean; account?: boolean; date?: boolean; reference?: boolean; description?: boolean },
): string[] {
  const doc =
    targetType === "customer_payment" ? "la factura" : targetType === "supplier_payment" ? "el gasto" : null;
  if (action === "VOID") {
    return [
      "Se avisa a Administración o Finanzas para que lo revise. Hasta que lo aprueben, no cambia nada.",
      "Al aprobarse, el registro queda tachado como «Anulado» (no se borra).",
      "En el banco se crea un movimiento «Reverso» por el mismo monto, en sentido contrario, con fecha de hoy.",
      doc ? `${doc[0].toUpperCase()}${doc.slice(1)} vuelve a deber ese monto.` : "El saldo de la cuenta vuelve a como estaba antes.",
      "Todo queda en la Auditoría: quién pidió, quién aprobó, cuándo y por qué.",
    ];
  }
  const money = changes.amount || changes.account;
  const lines = ["Se avisa a Administración o Finanzas para que lo revise. Hasta que lo aprueben, no cambia nada."];
  if (money) {
    lines.push(
      "Al aprobarse, el registro original queda tachado como «Anulado» y se crea uno nuevo con los datos correctos.",
      "En el banco: un «Reverso» del monto original y el movimiento nuevo con el monto o la cuenta correctos.",
    );
    if (doc) lines.push(`${doc[0].toUpperCase()}${doc.slice(1)} queda debiendo lo que corresponde con el monto nuevo.`);
  } else {
    lines.push("Al aprobarse, se cambia el dato en el mismo registro y en su movimiento de banco. El dinero no cambia.");
  }
  lines.push("Todo queda en la Auditoría con el antes y el después.");
  return lines;
}

/** Errores de la base convertidos a mensajes sencillos. */
export function correctionErrorMessage(message: string): string {
  const known: [string, string][] = [
    ["reconciled_locked", "Este movimiento está conciliado: quítale la marca de conciliado en Bancos antes de pedir la corrección."],
    ["already_pending", "Ya hay una corrección pendiente para este registro. Espera a que la aprueben o retírala en Cobros y pagos → Correcciones."],
    ["already_voided", "Este registro ya está anulado."],
    ["no_changes", "No cambiaste ningún dato. Escribe el valor correcto o elige «Anular»."],
    ["has_withholdings", "Este cobro tiene retenciones del cliente: para cambiar el monto, elige «Anular» y regístralo de nuevo."],
    ["multi_currency", "Este registro se hizo en otra moneda: para cambiar el monto o la cuenta, elige «Anular» y regístralo de nuevo."],
    ["currency_mismatch", "La cuenta nueva está en otra moneda. Elige «Anular» y regístralo de nuevo en la cuenta correcta."],
    ["amount_exceeds_balance", "El monto nuevo es mayor de lo que se debe en el documento."],
    ["invalid_amount", "El monto nuevo debe ser mayor que 0."],
    ["invalid_date", "La fecha no puede ser futura."],
    ["reason_required", "Escribe el motivo con un poco más de detalle (mínimo 10 letras)."],
    ["same_user", "No puedes aprobar una corrección que pediste tú: debe aprobarla otra persona de Administración o Finanzas."],
    ["not_pending", "Esta solicitud ya fue decidida o retirada. Actualiza la página."],
    ["not_owner", "Solo quien pidió la corrección puede retirarla."],
    ["not_manual", "Este movimiento viene de un cobro, pago, transferencia o anticipo: corrígelo desde su origen."],
    ["insufficient_funds", "La cuenta no tiene fondos suficientes para el reverso. Revisa el saldo de la cuenta."],
    ["credit_insufficient", "La tarjeta no tiene crédito disponible suficiente."],
    ["insufficient_privilege", "No tienes permiso para esta acción."],
    ["account_not_found", "La cuenta nueva no existe o está inactiva."],
    ["invalid_account_type", "Un cobro no puede entrar a una tarjeta de crédito."],
  ];
  for (const [code, text] of known) if (message.includes(code)) return text;
  const i = message.indexOf(": ");
  return i > 0 ? message.slice(i + 2) : message;
}
