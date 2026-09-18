# Propuesta Técnica — Facturación Electrónica (e-CF) DGII

**Estado: PENDIENTE DE EJECUCIÓN.** Este documento es la propuesta técnica
aprobada como plan (no como código) para cuando se decida avanzar con esta
fase. No ejecutar ningún cambio de código de esta fase sin antes confirmar
los dos puntos de la sección 9.

**Contexto**: existe un borrador previo (columnas `billing_type`, `e_ncf`,
`e_ncf_valid_until`, `payment_type_code`, `security_code`,
`digital_signature_at` en `invoices`, migración `048_electronic_billing.sql`,
y el PDF `lib/pdf/invoice-electronic-document.tsx`) hecho **sin seguir este
proceso** — es útil como borrador visual del PDF, pero el modelo de datos
real de este documento lo reemplaza cuando se ejecute esta fase.

---

## 1. Diagnóstico de la arquitectura actual

| Aspecto | Estado real |
|---|---|
| Lenguaje/Framework | Next.js 16 (App Router) + TypeScript + React |
| Base de datos | Supabase (PostgreSQL 17), RLS como control de acceso |
| Backend | Server Actions de Next.js — sin backend separado |
| Infraestructura | Vercel (deploy) + Supabase (BD/Auth/Storage) |
| Código fuente | Sí, propio, en GitHub (`mindfreak-manager`) |
| Proveedor de facturación electrónica | Ninguno todavía |
| Certificación DGII | No iniciada |
| Cómo se genera la factura hoy | `invoices` (Postgres) → PDF (`@react-pdf/renderer`) → link firmado de descarga. Numeración correlativa propia, no DGII |

**Módulos existentes que la solución debe respetar sin tocar**: Clientes,
Proyectos, Cotizaciones, Condiciones de pago, Cobros/Pagos, Bancos,
Reportes, Auditoría.

---

## 2. Arquitectura propuesta

```
┌─────────────────────┐      ┌──────────────────────────┐      ┌─────────────┐
│   ERP (como hoy)     │      │  Módulo e-CF (nuevo,      │      │    DGII     │
│                      │      │  desacoplado)             │      │             │
│ invoices (sin tocar) │─────▶│ ecf_documents             │─────▶│ Ambiente    │
│ NCF tradicional      │ 1:0..1│ ecf_xml                   │ HTTPS│ Certificación│
│ numeración propia    │      │ ecf_events (estados)      │      │ / Producción│
│                      │      │ ecf_types (catálogo)      │      │             │
└─────────────────────┘      └──────────────────────────┘      └─────────────┘
                                        │
                                        ▼
                              ┌──────────────────────┐
                              │ Adaptador DGII        │
                              │ (interfaz genérica —  │
                              │ hoy sin proveedor,    │
                              │ mañana el que sea)     │
                              └──────────────────────┘
```

**Decisión clave**: tabla **separada** `ecf_documents` con relación
`invoice_id` 1 a 0-o-1, en vez de columnas sueltas en `invoices`. La
factura tradicional no sabe nada de e-CF — el módulo e-CF la consulta y le
agrega su propio comprobante encima. Ventajas:
- Cambiar de proveedor de certificación en el futuro solo toca el módulo e-CF.
- Reportes/numeración/lógica de `invoices` actual no cambian.
- Se puede quitar el módulo e-CF completo sin dejar rastro en la factura tradicional.

---

## 3. Modelo de base de datos propuesto

```sql
-- Catálogo de tipos de e-CF (configurable, no hardcodeado)
ecf_types
  id, code (31,32,33,34,41,43,44,45,46,47), name, is_active

-- Secuencias autorizadas por la DGII (rangos que asigna)
ecf_sequences
  id, company_id, ecf_type_id, prefix, range_start, range_end,
  next_number, authorized_until, is_active

-- El comprobante electrónico en sí — separado de invoices
ecf_documents
  id, company_id, invoice_id (FK, nullable),
  ecf_type_id, e_ncf, sequence_id,
  status ('DRAFT','SIGNED','SENT','ACCEPTED','REJECTED','VOIDED','ERROR'),
  environment ('TEST','PRODUCTION'),
  track_id, dgii_response (jsonb),
  created_by, created_at

-- El XML en cada etapa (versionado, nunca se sobreescribe)
ecf_xml_versions
  id, ecf_document_id, kind ('GENERATED','SIGNED'), xml_content, created_at

-- Historial completo de estados (auditoría del ciclo)
ecf_events
  id, ecf_document_id, event_type, http_status, response_body,
  error_message, retry_count, created_at

-- Certificado digital (solo metadata — la clave privada NUNCA en la BD)
ecf_certificates
  id, company_id, alias, valid_from, valid_until, is_active
  -- la clave real vive en un vault/variable de entorno segura, no aquí
```

---

## 4. Reglas de negocio

1. Modalidad (Tradicional / Electrónica) se define por factura, pero solo
   puede elegirse "Electrónica" si:
   - La compañía tiene al menos una secuencia (`ecf_sequences`) activa y
     vigente para ese tipo de e-CF, **y**
   - El usuario tiene el permiso `invoices.issue_electronic` (nuevo,
     específico — no basta con `invoices.create`).
2. Nunca se genera un `e_ncf` manualmente — solo lo asigna la secuencia
   autorizada al momento de enviar a la DGII.
3. Un e-CF rechazado no se "corrige": se anula (o se emite Nota de
   Crédito) y se genera uno nuevo.
4. Reintentos de envío: máximo N intentos con backoff, nunca reenviar un
   documento ya `ACCEPTED`.
5. La factura tradicional sigue funcionando exactamente igual, sin
   ninguna dependencia del módulo e-CF.

---

## 5. Cambios de UI (mínimos, sobre lo existente)

- Selector "Tipo de facturación" — se queda, pero se deshabilita si no
  hay secuencia e-CF activa, con mensaje claro.
- Nueva pantalla **Configuración → Facturación Electrónica**: cargar
  certificado, definir secuencias autorizadas, ambiente (pruebas/producción).
- En el detalle de la factura: si tiene e-CF asociado, sección con
  estado, TrackID, botones para ver XML/respuesta (solo autorizados).
- Nuevo reporte: "Comprobantes electrónicos" — pendientes, aceptados,
  rechazados, con error.

---

## 6. Plan de pruebas

- Unitarias: generación de XML contra el schema oficial, dígito
  verificador del e-NCF, máquina de estados.
- Integración: contra el **ambiente de certificación** de la DGII (nunca
  producción) — envío, rechazo simulado, reintento, timeout.
- Regresión: confirmar que la factura tradicional sigue funcionando
  exactamente igual con el módulo e-CF instalado pero sin usar.

## 7. Plan de despliegue y rollback

- Módulo e-CF desplegado **apagado por defecto** (sin secuencias
  configuradas = nadie puede usarlo).
- Rollback: no toca `invoices`, desactivar el módulo es no mostrar el
  selector — cero riesgo para la factura tradicional.
- Piloto: 1-2 facturas reales en ambiente de certificación antes de
  producción.

## 8. Matriz de riesgos

| Riesgo | Mitigación |
|---|---|
| Servicio DGII caído al facturar | Factura queda `DRAFT`, se sigue facturando Tradicional |
| Duplicar un e-CF | Constraint único por secuencia+número antes de enviar |
| Exponer el certificado digital | Nunca en BD ni en código — variable de entorno segura |
| Reglas de la DGII desactualizadas | Confirmar con documentación oficial vigente antes de programar esa parte, nunca inventar |

---

## 9. Pendiente de confirmar antes de programar cualquier línea

1. **¿Certificación propia ante la DGII, o un proveedor certificado
   (facilitador de e-CF)?** Cambia bastante el diseño del "Módulo e-CF" —
   con un proveedor, probablemente ya dan una API/SDK y no hay que
   generar/firmar el XML directamente.
2. **¿Qué tipos de e-CF se necesitan emitir?** (para eventos, seguramente
   31-Crédito Fiscal y 32-Consumo — confirmar si hace falta alguno más).
3. Una vez respondido (1), buscar la documentación técnica vigente de ese
   camino específico antes de diseñar el módulo a detalle.

**Regla**: no escribir código de esta fase hasta tener respuesta a los
puntos 1 y 2 de esta sección.

---

**Siguiente paso cuando se retome**: responder los 2 puntos de la sección
9, y desde ahí seguir el plan de fases del documento original del usuario
(Fase 1: levantamiento → Fase 2: diseño técnico/modelo de datos →
Fase 3: módulo en ambiente de prueba → Fase 4: integración/pruebas DGII →
Fase 5: certificación → Fase 6: piloto → Fase 7: operación híbrida →
Fase 8: estabilización).
