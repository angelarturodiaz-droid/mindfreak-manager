/**
 * A0 — `manifest.json`: qué contiene la copia, conteos, totales de control y la huella SHA-256 de cada archivo.
 * Nunca lleva claves, URLs firmadas, correos ni cadenas de conexión.
 */
export type ManifestFile = { path: string; size: number; sha256: string };
export type Manifest = {
  format: "mindfreak-backup";
  formatVersion: 1;
  kind: "FULL" | "DB_ONLY";
  app: { name: string; version: string; lastMigration: string; environment: string };
  database: { postgres: string; tables: { name: string; rows: number }[]; totalRows: number; excludedTables: string[] };
  storage: { buckets: string[]; files: number; bytes: number } | null;
  controlTotals: Record<string, unknown>;
  startedAt: string;
  finishedAt: string;
  files: ManifestFile[];
};

export const EXCLUDED_TABLES = ["mfa_recovery_codes", "mfa_trusted_devices", "auth_login_attempts", "backup_runs"];

/** Palabras que nunca deben aparecer como columnas o tablas exportadas (prueba de seguridad). */
export const FORBIDDEN_KEYS = ["encrypted_password", "password", "secret", "totp", "recovery_code", "refresh_token", "confirmation_token", "recovery_token"];

export function backupFileName(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  // Hora de RD (UTC−4), que es la que ve el usuario.
  const d = new Date(date.getTime() - 4 * 3600 * 1000);
  return `mindfreak-respaldo-${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}.zip`;
}

export function buildManifest(input: Omit<Manifest, "format" | "formatVersion">): Manifest {
  return { format: "mindfreak-backup", formatVersion: 1, ...input };
}

export const README_RESTORE = `MINDFREAK MANAGER — CÓMO RESTAURAR ESTA COPIA
=============================================

Esta copia trae:
  database/data.sql          todos los datos, para cargar con psql
  database/tables/*.json     los mismos datos, una tabla por archivo (para leer o revisar)
  database/auth-users.json   los usuarios (sin contraseñas ni verificación en dos pasos)
  database/estructura-tablas.sql  foto de las tablas (para revisar o para una restauración de PRUEBA)
  storage/documents/...      todos los documentos, con su ruta original
  manifest.json              conteos, totales de control y la huella SHA-256 de cada archivo

IMPORTANTE: guárdala en un disco cifrado y en dos lugares. No la envíes por correo ni WhatsApp.

Restaurar (recomendado: primero en un proyecto de Supabase APARTE, nunca encima del de producción sin revisar):
 1. Verificar:   node scripts/backup/verify-backup.mjs <carpeta descomprimida>
 2. Estructura:  git checkout del código que tenga la migración indicada en manifest.json (app.lastMigration)
                 y aplicar las migraciones 001 → esa, en orden, en la base nueva.
 3. Datos:       psql "$DB_URL" -f database/data.sql
 4. Documentos:  node scripts/backup/restore-storage.mjs <carpeta descomprimida>
 5. Usuarios:    node scripts/backup/restore-users.mjs <carpeta descomprimida>
                 (se recrean con el mismo id; cada persona pone contraseña nueva con «¿Olvidaste tu contraseña?»
                 y vuelve a activar la verificación en dos pasos)
 6. Logo:        volver a subirlo en Configuración → Sistema.
 7. Comprobar:   que los conteos y los totales de control coincidan con manifest.json.

Las instrucciones completas están en scripts/backup/README.md del código.
`;
