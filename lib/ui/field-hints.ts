/**
 * Explicaciones sencillas de términos fiscales y de pagos, para el ícono ⓘ
 * de los formularios (prop `info` de Input/Select/Textarea, o <InfoHint>).
 * Pensadas para alguien que no es contador. Un solo lugar para cambiarlas.
 */
export const FIELD_HINTS = {
  fiscalClassification:
    "Para la DGII no es lo mismo pagar un servicio técnico, un profesional, un alquiler o comprar productos: cada uno tiene retenciones distintas. Aquí dices a cuál se parece este tipo de servicio y el sistema aplica la regla que corresponde.",
  serviceTypeFiscal:
    "Si un tipo de servicio no tiene clasificación fiscal, al registrar un gasto el sistema te avisará que falta y no calculará retenciones.",
  supplierKind:
    "Persona Física: una persona (usa Cédula). Persona Jurídica: una empresa (usa RNC). Negocio de Único Dueño: una persona con negocio registrado a su nombre.",
  fiscalCondition:
    "Registrado DGII: tiene RNC/Cédula activo y entrega comprobante fiscal (NCF). Informal: no está registrado (se le hace comprobante de compras). RST: régimen simplificado de tributación.",
  taxResidence: "Dónde paga impuestos el proveedor. Si es del extranjero, el pago puede llevar otras retenciones.",
  eIssuer:
    "Si el proveedor emite facturas electrónicas (e-CF, empiezan con E). Algunas retenciones no aplican cuando la factura es electrónica.",
  documentType:
    "El tipo de comprobante fiscal que te entregó el proveedor: crédito fiscal (B01/E31), consumo (B02/E32), gastos menores (B13/E43), comprobante de compras para informales (B11/E41), etc.",
  ncf: "Número de Comprobante Fiscal que aparece en la factura del proveedor. Sirve para el reporte 606 a la DGII.",
  isrWithheld:
    "ISR retenido: parte del pago que la empresa se queda y luego le paga a la DGII a nombre del proveedor (impuesto sobre la renta). El proveedor lo descuenta de sus impuestos.",
  itbisWithheld:
    "ITBIS retenido: parte del ITBIS de la factura que no se le entrega al proveedor porque la empresa debe pagarlo directamente a la DGII.",
  totalWithheld: "Suma de lo retenido (ISR + ITBIS). Es dinero que se le debe a la DGII, no al proveedor.",
  documentTotal: "Lo que dice la factura del proveedor: subtotal más ITBIS. Es el costo real del gasto.",
  netPayable:
    "Neto a pagar: lo que realmente recibe el proveedor = total de la factura − retenciones. Es el monto que sale del banco al pagarle.",
  pendingNet: "Lo que todavía falta por pagarle al proveedor, ya descontadas las retenciones.",
  expenseServiceType:
    "Qué se le está pagando al proveedor en este gasto (ej. Fotografía, Alquiler de sillas). Se sugiere el del proveedor, pero puedes cambiarlo: de esto depende qué retenciones aplican.",
  fiscalTreatment:
    "Según quién es el proveedor y qué servicio da, la ley puede obligar a la empresa a quedarse con una parte del pago (retención) y entregarla a la DGII. El sistema lo calcula solo con las reglas de Configuración → Reglas fiscales.",
  fiscalRecalculate:
    "Vuelve a calcular las retenciones con los datos y reglas de hoy (por ejemplo, después de completar la ficha del proveedor). Solo mientras el gasto no tenga pagos; si había un ajuste manual, se reemplaza por el cálculo de las reglas.",
  fiscalOverride:
    "Cambiar a mano lo retenido cuando el contador indica algo distinto a la regla. Pide un motivo y queda registrado quién lo hizo. Solo para quien aprueba gastos.",
  paymentAmountNet:
    "Se propone lo que falta por pagarle al proveedor ya descontadas las retenciones. Puedes pagar menos si es un abono, pero no más.",
  functionalCurrency:
    "La moneda en la que la empresa lleva sus números (reportes, dashboard, equivalentes). Las demás monedas se convierten a esta con la tasa de referencia. No se puede cambiar cuando ya hay documentos o movimientos.",
  referenceRate:
    "El precio de una moneda en tu moneda funcional para un día: 1 USD = 58.80 DOP. Sirve de referencia para comparar lo que el banco realmente cobró o pagó. Cada operación guarda la tasa que usó; cambiar o borrar una tasa aquí no modifica operaciones pasadas.",
  rateSource:
    "De dónde sale la tasa de referencia: la publicada por el Banco Central/DGII, la que te da tu banco, una que escribes a mano u otra fuente.",
  roundingTolerance:
    "Diferencias muy pequeñas (hasta este monto, en moneda funcional) entre lo esperado y lo que el banco debitó se registran como redondeo y no como diferencia. Ej.: 1.00 = hasta un peso.",
  foreignPayment:
    "La cuenta está en otra moneda que el documento. El documento (gasto o factura) baja por el monto en su moneda; la cuenta se mueve solo por lo que el banco realmente debitó o acreditó, en la moneda de la cuenta. Si el banco cobró comisión, se registra aparte como Comisiones bancarias. La tasa efectiva sale de esos dos montos; la diferencia con la tasa de referencia es solo informativa (no es ganancia ni pérdida contable).",
  transferReceived:
    "Cuando las dos cuentas están en monedas distintas, escribe lo que realmente entró en la cuenta destino (su estado de cuenta). Cada cuenta se mueve solo en su moneda; la tasa efectiva sale de los dos montos. La tasa del día es opcional y solo sirve para comparar (diferencia informativa, no es ganancia ni pérdida contable).",
  feeLink:
    "Si el banco cobró una comisión días después de un pago, cobro o transferencia, elígelo aquí: la comisión queda ligada a esa operación y en la categoría Comisiones bancarias (si no eliges otra). No cambia el monto de la operación original.",
  currencyCatalog:
    "Las monedas que se pueden elegir al crear cuentas, cotizaciones, facturas y gastos. Desactivar una moneda solo la quita de las listas: lo ya registrado no cambia.",
} as const;
