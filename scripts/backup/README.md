# Copias de seguridad — restaurar (A0)

La copia se crea en **Configuración → Copias de seguridad** (solo Administración, con el código de verificación en dos pasos).
Es un ZIP que se guarda en tu computadora: guárdalo en un disco cifrado y en dos lugares. **Nunca** se sube a GitHub.

## Qué trae

| Archivo | Para qué |
|---|---|
| `manifest.json` | Versión, conteos por tabla, totales de control y la huella SHA-256 de cada archivo |
| `database/data.sql` | Todos los datos, para cargar con `psql` sobre la estructura de las migraciones |
| `database/tables/*.json` | Los mismos datos, legibles |
| `database/auth-users.json` | Usuarios: id, correo, nombre, teléfono (sin contraseñas, MFA, tokens ni sesiones) |
| `database/estructura-tablas.sql` | Foto de las tablas, solo para revisar o para una restauración de **prueba** |
| `storage/documents/...` | Los documentos con su ruta exacta |

No van: `mfa_recovery_codes`, `mfa_trusted_devices`, `auth_login_attempts` ni `backup_runs`.

## 1. Comprobar la copia

```bash
unzip mindfreak-respaldo-AAAA-MM-DD-HHMM.zip -d respaldo
node scripts/backup/verify-backup.mjs respaldo
```

## 2. Restauración de prueba (sin tocar Supabase)

En una base Postgres local y vacía:

```bash
createdb restore_test
scripts/backup/test-restore-local.sh respaldo postgresql://localhost/restore_test
```

Carga la estructura de prueba y los datos, y compara filas y totales (facturas, cobros, gastos, pagos y saldo de cada cuenta)
con el manifest. Debe terminar en «✓ Restauración igual a la copia».

## 3. Restauración real (si un día hace falta)

Recomendado: primero en un proyecto de Supabase **nuevo**, nunca encima del de producción sin revisar.

1. `git checkout` de un commit que tenga la migración indicada en `manifest.json` → `app.lastMigration`.
2. Aplicar las migraciones `001` → esa, en orden, en el proyecto nuevo (SQL Editor o `supabase db push`).
3. Datos: `psql "$DB_URL" -v ON_ERROR_STOP=1 -f respaldo/database/data.sql` (desactiva triggers mientras carga).
4. Usuarios (proyecto nuevo):
   `SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/backup/restore-users.mjs respaldo`
   Cada persona pone contraseña nueva con «¿Olvidaste tu contraseña?» y vuelve a activar la verificación en dos pasos.
5. Documentos: `SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/backup/restore-storage.mjs respaldo`
6. Logo: volver a subirlo en Configuración → Sistema (la dirección guardada es del proyecto anterior).
7. Variables de Cloudflare, Vault (`reminders_url`, `reminders_cron_secret`), SMTP y dominio: ver `claude/checklist-produccion.md`.
8. Comprobar: `node scripts/backup/compare-restore.mjs respaldo "$DB_URL"` y entrar al sistema (una factura con su PDF, Bancos, Reportes).

La llave de servicio y la cadena de conexión se escriben en la Terminal en el momento: **no** se guardan en el proyecto.
