-- Auditoría de seguridad a pedido explícito del usuario (revisar que nada
-- quede público/expuesto sin necesidad). Todas las tablas de public ya
-- tenían RLS habilitado con políticas (se verificó una por una, ninguna
-- expuesta) — esta migración cierra lo que sí encontró el linter de
-- seguridad de Supabase (get_advisors) más dos buckets de Storage que el
-- linter no cubre.

-- 1) Tres funciones de anti-fuerza-bruta del login (get_login_attempts,
--    record_failed_login, reset_login_attempts) son SECURITY DEFINER y
--    estaban otorgadas a PUBLIC/anon/authenticated — necesario para poder
--    llamarlas ANTES de iniciar sesión, pero eso también las deja
--    expuestas directamente como endpoint RPC de PostgREST
--    (/rest/v1/rpc/reset_login_attempts) a cualquiera con la anon key
--    (pública por diseño), sin pasar por la app: un atacante podía
--    resetear el contador de intentos fallidos de la víctima a voluntad,
--    anulando el captcha que exige features/auth/actions.ts a partir de 3
--    intentos. El código ahora llama a estas tres funciones desde el
--    cliente admin (service_role, servidor únicamente — ver
--    features/auth/actions.ts), así que ya no hace falta exponerlas por
--    PostgREST.
revoke execute on function public.get_login_attempts(text) from public, anon, authenticated;
revoke execute on function public.record_failed_login(text) from public, anon, authenticated;
revoke execute on function public.reset_login_attempts(text) from public, anon, authenticated;

-- 2) create_card_expense y register_supplier_payment sí revisan
--    has_permission()/auth.uid() por dentro (un anon nunca pasa ese
--    chequeo porque auth.uid() es null sin sesión), así que no eran
--    explotables — pero seguían otorgadas a PUBLIC/anon igual que las de
--    arriba, a diferencia de sus funciones hermanas (create_bank_transfer,
--    register_customer_payment) que ya solo estaban en `authenticated`.
--    Se alinean por defensa en profundidad y para que el linter deje de
--    marcarlas.
revoke execute on function public.create_card_expense(uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric, numeric, text, numeric, text, text) from public, anon;
revoke execute on function public.register_supplier_payment(uuid, uuid, uuid, uuid, uuid, date, numeric, text, text, text, numeric, text, text) from public, anon;

-- 3) Dos funciones de trigger (no llamables directamente vía RPC — Postgres
--    rechaza "trigger functions can only be called as triggers") no
--    tenían `search_path` fijo, señalado por el linter
--    (function_search_path_mutable). Sin impacto práctico real aquí, pero
--    se corrige por higiene y para no dejar el aviso abierto.
alter function public.guard_expense_cancel() set search_path = public;
alter function public.calculate_invoice_due_date() set search_path = public;

-- 4) Bucket 'branding': deprecado desde la migración 041 (el logo de la
--    empresa se guarda en 'documents', privado, con link firmado), pero
--    seguía marcado público y tenía un archivo de prueba de cuando se
--    armó ("logo-test-noauth.png") servido sin autenticación a cualquiera.
--    Al marcarlo privado ese archivo deja de ser legible sin sesión — no
--    se puede borrar el objeto en sí por SQL directo (Storage lo bloquea
--    a propósito, "Direct deletion from storage tables is not allowed");
--    borrarlo del todo requiere el botón "Eliminar" en el Dashboard, pero
--    ya no es un riesgo de seguridad una vez privado, así que queda como
--    limpieza opcional. Tampoco se puede borrar el bucket en sí por SQL
--    (protect_buckets_delete) — queda inerte, marcado privado.
update storage.buckets set public = false where id = 'branding';

-- 5) Bucket 'zzz-test-bucket': bucket de prueba, vacío, sin ninguna
--    política de storage.objects, y público. No tiene ningún uso en la
--    app (no aparece en el código). Se marca privado por seguridad; como
--    con 'branding', el borrado del bucket en sí requiere hacerse desde
--    el Dashboard o la API de Storage (no SQL directo).
update storage.buckets set public = false where id = 'zzz-test-bucket';
