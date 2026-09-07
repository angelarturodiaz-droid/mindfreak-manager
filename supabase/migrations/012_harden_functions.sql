-- F3: Endurecer funciones detectadas por los security advisors de Supabase.
-- 1) set_updated_at no tenía search_path fijo (riesgo de search_path hijacking).
-- 2) handle_new_user() no debe ser invocable vía RPC público (solo la usa el
--    trigger de auth.users).
-- 3) has_permission() no necesita ser ejecutable por el rol "anon" (no autenticado).

alter function public.set_updated_at() set search_path = public;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.has_permission(text) from public, anon;
