# Respaldo automático de Mindfreak Manager

Todos los días a las ~04:10 hora de Santo Domingo, un workflow de GitHub
Actions (`.github/workflows/backup.yml`) hace lo siguiente, sin depender
de ningún equipo encendido:

1. Vuelca el esquema `public` de la base de datos (todos los datos de
   negocio: clientes, facturas, gastos, cotizaciones, proyectos,
   perfiles de usuario, roles, auditoría, etc.) con `pg_dump`.
2. Descarga todos los archivos de todos los buckets de Storage
   (`documents`, `branding`, `zzz-test-bucket`).
3. Empaqueta todo junto y lo cifra con una contraseña (AES-256).
4. Sube el archivo cifrado a la rama `backups` de este mismo repositorio
   — un archivo por día, se conservan los últimos 30.

**Qué NO cubre:** las cuentas de Supabase Auth (login, contraseñas, MFA)
— esas las administra Supabase internamente y no se restauran con
`pg_dump`. Si algún día hay que reconstruir el proyecto desde cero, los
datos de negocio vuelven intactos con esto, pero los usuarios habría que
volver a invitarlos desde `/settings/users` (ya no necesitan contraseña
nueva puesta a mano — el flujo de invitación se encarga).

## Configuración (una sola vez)

En GitHub: **Settings → Secrets and variables → Actions → New repository
secret**, agrega estos 4 secretos:

| Secreto | De dónde sale |
|---|---|
| `BACKUP_DB_URL` | Dashboard de Supabase → Settings → Database → Connection string → URI → pestaña **"Direct connection"** (no la del pooler/6543). Incluye la contraseña de la base de datos. |
| `SUPABASE_URL` | Dashboard de Supabase → Settings → API → Project URL |
| `SUPABASE_SECRET_KEY` | Dashboard de Supabase → Settings → API Keys → la "secret" (la misma que ya usas en `.env.local` para `SUPABASE_SECRET_KEY`) |
| `BACKUP_ENCRYPTION_PASSPHRASE` | Invéntate una contraseña larga y guárdala en un lugar seguro (gestor de contraseñas) — sin ella, los respaldos NO se pueden desencriptar, ni siquiera nosotros. |

Con los 4 secretos puestos, el workflow ya queda activo con su horario
diario. También se puede lanzar a mano: pestaña **Actions** → "Respaldo
diario (base de datos + Storage)" → **Run workflow**.

## Cómo restaurar un respaldo

1. Ve a la rama `backups` del repo y descarga el archivo
   `backup-YYYY-MM-DD.tar.gz.enc` que quieras restaurar.
2. Desencripta y descomprime (te va a pedir la `BACKUP_ENCRYPTION_PASSPHRASE`):
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 \
     -in backup-2026-09-20.tar.gz.enc \
     -out backup-2026-09-20.tar.gz
   tar -xzf backup-2026-09-20.tar.gz
   # queda una carpeta db/ (con public.sql) y otra storage/ (con los buckets)
   ```
3. Restaura la base de datos:
   ```bash
   ./restore-database.sh "postgresql://postgres:...@...:5432/postgres" db/public.sql
   ```
4. Restaura los archivos de Storage:
   ```bash
   SUPABASE_URL="https://tu-proyecto.supabase.co" \
   SUPABASE_SECRET_KEY="..." \
   node restore-storage.mjs storage
   ```

## Archivos de esta carpeta

- `backup-storage.mjs` — descarga todo Storage a una carpeta local (lo usa el workflow).
- `restore-storage.mjs` — sube una carpeta local de vuelta a Storage (recrea buckets si hace falta, siempre privados).
- `restore-database.sh` — corre el `public.sql` contra una base de datos de Supabase.
