-- 091 — «Hoy» en hora de República Dominicana dentro de las funciones (29-oct-2026).
--
-- La base de datos trabaja en UTC (hora de Londres). De 8:00 p. m. a medianoche
-- en RD, `current_date` ya es el día siguiente: un anticipo aplicado el 29-oct
-- de noche quedaba con fecha 30-oct. Se fija la zona horaria
-- America/Santo_Domingo en las funciones que usan «hoy» (current_date), sin
-- cambiar su lógica. Las horas guardadas (timestamptz) no cambian.
-- Solo cambia configuración de funciones. Idempotente.

alter function public.apply_customer_advance(uuid, uuid, numeric, date) set timezone = 'America/Santo_Domingo';
alter function public.refund_customer_advance(uuid, numeric, date, uuid, text, numeric, boolean) set timezone = 'America/Santo_Domingo';
alter function public.transfer_customer_advance(uuid, uuid, uuid, text) set timezone = 'America/Santo_Domingo';
alter function public.release_advances_on_invoice_cancel() set timezone = 'America/Santo_Domingo';
alter function public.generate_due_date_alerts() set timezone = 'America/Santo_Domingo';
alter function public.reminder_mark_whatsapp(uuid, integer, text) set timezone = 'America/Santo_Domingo';
alter function public.reminders_candidates(text) set timezone = 'America/Santo_Domingo';
alter function public.reminders_finish(text, jsonb) set timezone = 'America/Santo_Domingo';
