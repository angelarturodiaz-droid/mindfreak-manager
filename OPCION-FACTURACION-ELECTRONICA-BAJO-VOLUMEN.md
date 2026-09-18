# Facturación Electrónica DGII — Opción para bajo volumen (menos de 10 facturas/mes)

**Estado: decisión tomada para el corto plazo.** Este documento reemplaza,
para el volumen actual de Mindfreak Events, la necesidad de construir una
integración por API con la DGII o con un proveedor certificado (ver
`FASE-FACTURACION-ELECTRONICA-DGII.md` para esa opción, que queda en
espera para cuando el volumen lo justifique).

---

## Contexto

- Volumen actual: **menos de 10 facturas al mes**.
- La DGII ofrece un **Facturador Gratuito** — portal web propio, sin costo.
- Confirmado con la propia DGII: *"esta herramienta solo emite facturas,
  no sustituye ningún sistema contable"* — es decir, **no se conecta ni
  se integra con ningún sistema externo** (no tiene API, no acepta carga
  de datos desde otro software). Todo lo que se factura ahí se captura a
  mano en su portal.
- Tope orientativo de la DGII para el Facturador Gratuito: ~150
  comprobantes/mes — muy por encima del volumen actual, así que no es un
  problema.

## Decisión

Con menos de 10 facturas al mes, la carga de escribir cada una dos veces
(una en Mindfreak Manager, otra en el portal de la DGII) es mínima —
literalmente minutos al mes. **No se justifica construir ninguna
integración técnica todavía.**

## Cómo funciona el flujo

1. **Mindfreak Manager sigue siendo el sistema de gestión completo**, sin
   ningún cambio: Cliente → Cotización → Proyecto → Factura → Cobro →
   Banco, con condiciones de pago, comisión, reportes, todo igual que
   hasta ahora. La factura generada aquí es el **documento de control
   interno**.
2. Cuando la factura está lista para el cliente, se **entra al portal del
   Facturador Gratuito de la DGII** y se vuelve a capturar ahí (cliente,
   RNC, líneas, montos) — de ahí sale el **e-NCF real**, con código de
   seguridad y QR válidos, generados por la propia DGII.
3. **El PDF que se le entrega al cliente es el que emite la DGII**, no el
   de Mindfreak Manager — ese es el documento con validez fiscal real.
4. **Opcional**: volver a Mindfreak Manager y guardar el e-NCF real (ya
   emitido por la DGII) en el campo `e_ncf` que ya existe en el sistema —
   solo como referencia/archivo propio, no porque el sistema lo genere.
   Esto no es obligatorio, es una comodidad para tener todo junto al
   consultar una factura vieja.

## Qué NO hace falta construir (por ahora)

- Ninguna integración por API con la DGII ni con un proveedor certificado.
- Ninguna generación/firma de XML.
- Ningún manejo de TrackID, reintentos, ni estados de envío — todo eso
  vive en el portal de la DGII, no en Mindfreak Manager.
- El módulo `ecf_documents` de la propuesta técnica completa
  (`FASE-FACTURACION-ELECTRONICA-DGII.md`) queda **en espera**, no
  cancelado — se retoma si el volumen de facturación crece lo suficiente
  como para que la doble captura manual deje de ser práctica.

## Pendiente de confirmar (no técnico, fiscal/legal)

- La DGII otorgó una **prórroga hasta el 15 de noviembre de 2026** para
  contribuyentes pequeños, micro y no clasificados (Aviso DGII 06-26).
  **Falta confirmar con el contador de Mindfreak Events, o directamente
  con la DGII, en qué categoría cae la empresa y cuál es su fecha límite
  real** — es posible que la facturación electrónica todavía no sea
  obligatoria hoy mismo.
- Confirmar los requisitos para solicitar el Facturador Gratuito (estar
  al día con la DGII, usuario de la Oficina Virtual, certificado digital
  gratuito vía el mismo Facturador Gratuito).

## Cuándo reconsiderar la integración técnica completa

Si el volumen de facturación crece de forma sostenida (ej. varias
facturas por semana, o se vuelve operativamente pesado capturar dos
veces), retomar `FASE-FACTURACION-ELECTRONICA-DGII.md` — ese documento ya
tiene el diagnóstico, la arquitectura desacoplada, el modelo de datos, y
la comparación entre ir directo con la DGII vs. un proveedor certificado
(PSFE), con la recomendación de ir por un proveedor certificado para
evitar construir la generación/firma de XML desde cero.
