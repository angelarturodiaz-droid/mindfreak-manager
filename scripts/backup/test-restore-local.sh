#!/usr/bin/env bash
# Restauración de PRUEBA en una base Postgres vacía y local (no toca Supabase).
# Carga database/estructura-tablas.sql + database/data.sql y compara conteos y totales con manifest.json.
# Uso: scripts/backup/test-restore-local.sh <carpeta descomprimida> [cadena de conexión a una base VACÍA]
set -euo pipefail
DIR="${1:?Uso: test-restore-local.sh <carpeta> [db-url]}"
DB="${2:-postgresql://postgres@localhost:5432/restore_test}"
psql "$DB" -v ON_ERROR_STOP=1 -q -f "$DIR/database/estructura-tablas.sql"
psql "$DB" -v ON_ERROR_STOP=1 -q -f "$DIR/database/data.sql"
node "$(dirname "$0")/compare-restore.mjs" "$DIR" "$DB"
