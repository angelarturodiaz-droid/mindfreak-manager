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
} as const;
