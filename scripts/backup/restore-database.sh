#!/usr/bin/env bash
# Restaura un dump del esquema `public` generado por el workflow de
# respaldo (backup.yml) contra una base de datos de Supabase.
#
# Uso:
#   ./restore-database.sh "postgresql://postgres:CONTRASEÑA@HOST:5432/postgres" public.sql
#
# El primer argumento es la cadena de conexión DIRECTA (no el pooler
# 6543) — Dashboard de Supabase → Settings → Database → Connection
# string → URI → "Direct connection".
#
# OJO: esto ejecuta el SQL del dump tal cual contra la base de datos de
# destino — pensado para un proyecto de Supabase NUEVO y vacío (o el
# mismo proyecto después de una pérdida de datos real), no para
# "mezclar" con datos que ya existan; puede fallar por choques de
# llaves primarias/únicas si la base de datos destino ya tiene datos.

set -euo pipefail

DB_URL="${1:?Falta la cadena de conexión (primer argumento)}"
DUMP_FILE="${2:?Falta la ruta al archivo public.sql (segundo argumento)}"

echo "Restaurando $DUMP_FILE contra la base de datos..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$DUMP_FILE"
echo "Listo."
echo
echo "Recordatorio: este respaldo cubre el esquema 'public' (todos los"
echo "datos de negocio — clientes, facturas, gastos, usuarios/perfiles,"
echo "etc.) y los archivos de Storage (con restore-storage.mjs), pero NO"
echo "las cuentas de Supabase Auth (contraseñas, MFA) — esas hay que"
echo "recrearlas invitando a los usuarios de nuevo desde /settings/users."
