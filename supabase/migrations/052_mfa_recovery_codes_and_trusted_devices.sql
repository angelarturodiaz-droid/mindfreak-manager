-- Recuperación de MFA (perder el acceso al autenticador) y "equipos de
-- confianza" (no pedir el código en el login normal por 90 días).
-- Ver CHANGELOG.md para el diseño completo — ninguna de las dos cosas se
-- puede resolver dentro del propio mecanismo de AAL de Supabase, así que
-- ambas se implementan como tablas propias de la app.

-- Códigos de recuperación de un solo uso — se generan 10 a la vez desde el
-- perfil, se muestran en texto plano una sola vez, y acá solo se guarda el
-- hash (sha256, ver lib/mfa/recovery-codes.ts), nunca el código real.
create table if not exists mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mfa_recovery_codes_user_id_idx on mfa_recovery_codes(user_id);
create unique index if not exists mfa_recovery_codes_hash_idx on mfa_recovery_codes(code_hash);

alter table mfa_recovery_codes enable row level security;

-- Cada quien solo ve/gestiona sus propios códigos. La generación borra los
-- anteriores e inserta los nuevos (regenerar invalida los viejos) — todo
-- desde Server Actions con el cliente normal, sin necesidad de bypass.
create policy mfa_recovery_codes_select on mfa_recovery_codes
  for select using (user_id = auth.uid());
create policy mfa_recovery_codes_insert on mfa_recovery_codes
  for insert with check (user_id = auth.uid());
create policy mfa_recovery_codes_update on mfa_recovery_codes
  for update using (user_id = auth.uid());
create policy mfa_recovery_codes_delete on mfa_recovery_codes
  for delete using (user_id = auth.uid());

-- Equipos de confianza — evitan pedir el código del autenticador en el
-- login normal por 90 días (TRUSTED_DEVICE_DAYS en
-- lib/mfa/trusted-devices.ts). El valor real del token vive solo en una
-- cookie httpOnly del navegador; acá se guarda nada más el hash.
create table if not exists mfa_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists mfa_trusted_devices_user_id_idx on mfa_trusted_devices(user_id);

alter table mfa_trusted_devices enable row level security;

create policy mfa_trusted_devices_select on mfa_trusted_devices
  for select using (user_id = auth.uid());
create policy mfa_trusted_devices_insert on mfa_trusted_devices
  for insert with check (user_id = auth.uid());
create policy mfa_trusted_devices_update on mfa_trusted_devices
  for update using (user_id = auth.uid());
create policy mfa_trusted_devices_delete on mfa_trusted_devices
  for delete using (user_id = auth.uid());
