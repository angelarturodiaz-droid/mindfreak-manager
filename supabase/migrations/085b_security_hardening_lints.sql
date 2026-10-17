-- 085b — Ajustes que marcó el revisor de seguridad de Supabase tras la 085.
-- Las funciones de los triggers no se deben poder llamar como RPC y la
-- función de la excepción de mantenimiento fija su search_path.
revoke all on function public.guard_invoice_items_locked() from public, anon, authenticated;
revoke all on function public.guard_invoice_locked() from public, anon, authenticated;
revoke all on function public.guard_quotation_items_locked() from public, anon, authenticated;
alter function public.mf_locked_docs_bypass() set search_path to 'public';
