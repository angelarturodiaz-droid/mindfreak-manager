-- Protección anti fuerza-bruta en el login: lleva la cuenta de intentos
-- fallidos por correo (ventana de 15 minutos) para que la pantalla de login
-- pueda pedir un captcha (Cloudflare Turnstile) cuando detecta comportamiento
-- sospechoso. No cambia el flujo normal de un usuario que entra bien a la
-- primera — solo se activa después de varios intentos fallidos seguidos.

create table if not exists auth_login_attempts (
  identifier text primary key,
  attempts int not null default 0,
  first_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now()
);

comment on table auth_login_attempts is
  'Contador de intentos de login fallidos por correo (ventana de 15 min), usado para exigir captcha tras comportamiento sospechoso. Solo accesible vía las funciones SECURITY DEFINER de abajo.';

alter table auth_login_attempts enable row level security;
-- Sin policies a propósito: nadie puede leer/escribir esta tabla
-- directamente (ni siquiera un usuario autenticado), solo a través de las
-- funciones SECURITY DEFINER de abajo, que es justo lo que necesita el
-- login (que ocurre sin sesión todavía).

-- Registra un intento fallido y devuelve el conteo vigente (reinicia la
-- ventana si el último intento fue hace más de 15 minutos).
create or replace function record_failed_login(p_identifier text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts int;
  v_window interval := interval '15 minutes';
begin
  insert into auth_login_attempts (identifier, attempts, first_attempt_at, last_attempt_at)
  values (lower(trim(p_identifier)), 1, now(), now())
  on conflict (identifier) do update
    set attempts = case
          when auth_login_attempts.last_attempt_at < now() - v_window then 1
          else auth_login_attempts.attempts + 1
        end,
        first_attempt_at = case
          when auth_login_attempts.last_attempt_at < now() - v_window then now()
          else auth_login_attempts.first_attempt_at
        end,
        last_attempt_at = now()
  returning attempts into v_attempts;

  return v_attempts;
end;
$$;

-- Conteo vigente de intentos fallidos (0 si no hay ninguno reciente).
create or replace function get_login_attempts(p_identifier text)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(attempts, 0)
  from auth_login_attempts
  where identifier = lower(trim(p_identifier))
    and last_attempt_at > now() - interval '15 minutes';
$$;

-- Limpia el contador tras un login exitoso.
create or replace function reset_login_attempts(p_identifier text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth_login_attempts where identifier = lower(trim(p_identifier));
$$;

grant execute on function record_failed_login(text) to anon, authenticated;
grant execute on function get_login_attempts(text) to anon, authenticated;
grant execute on function reset_login_attempts(text) to anon, authenticated;
