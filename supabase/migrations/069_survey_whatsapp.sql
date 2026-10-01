-- 069: Encuesta de satisfacción por WhatsApp (además del correo, o en vez de él).
--
-- * project_surveys: teléfono del destinatario y registro de envíos por
--   WhatsApp (fecha del primero/último y cuántas veces). El envío lo hace la
--   persona desde su WhatsApp (enlace wa.me con el mensaje y el enlace de la
--   encuesta ya escritos); el ERP solo registra que se compartió.
-- * survey_settings: plantilla del mensaje de WhatsApp ({enlace} = enlace de
--   la encuesta).
--
-- Solo agrega columnas con valores por defecto: no cambia datos existentes.
-- Idempotente.

alter table public.project_surveys
  add column if not exists recipient_phone text,
  add column if not exists whatsapp_sent_at timestamptz,
  add column if not exists whatsapp_last_sent_at timestamptz,
  add column if not exists whatsapp_count integer not null default 0;

alter table public.survey_settings
  add column if not exists whatsapp_message text not null
    default 'Hola {contacto}, gracias por confiar en {empresa} para {proyecto}. ¿Nos ayudas con esta breve encuesta? Te toma menos de 2 minutos: {enlace}';
