-- Módulo "Mi perfil": separado en Perfil (nombre, ocupación, teléfono) e
-- Inicio de sesión y seguridad (correo, contraseña). Falta el campo de
-- ocupación/cargo del usuario.
alter table public.profiles
  add column if not exists position text;
