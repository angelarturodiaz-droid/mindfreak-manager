/**
 * A0 — Arma `data.sql` (restauración con psql) a partir de las filas exportadas. Funciones puras (con pruebas).
 *
 * Cada tabla va como:
 *   insert into public.<t> (<columnas>) select <columnas> from json_populate_recordset(null::public.<t>, $tag$[...]$tag$);
 * así Postgres convierte cada valor a su tipo real (numeric, fecha, jsonb, uuid…) sin conversiones a mano.
 * Las columnas calculadas (generated) no van: la base las vuelve a calcular.
 * Arriba va `session_replication_role = replica` (igual que `supabase db dump --data-only`): durante la carga no se
 * disparan triggers ni se revisan relaciones, así el orden de las tablas no importa.
 */
export type BackupTableData = { name: string; columns: string[]; rows: Record<string, unknown>[] };

const ROWS_PER_STATEMENT = 500;

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Etiqueta $...$ que no aparece dentro del texto (para no romper el literal). */
export function dollarTag(text: string, seed = "mfbk"): string {
  let i = 0;
  let tag = `$${seed}$`;
  while (text.includes(tag)) {
    i += 1;
    tag = `$${seed}${i}$`;
  }
  return tag;
}

export function tableInsertSql(table: BackupTableData): string {
  const t = `public.${quoteIdent(table.name)}`;
  if (table.rows.length === 0) return `-- ${table.name}: sin filas\n`;
  const cols = table.columns.map(quoteIdent).join(", ");
  const parts: string[] = [`-- ${table.name}: ${table.rows.length} filas`];
  for (let i = 0; i < table.rows.length; i += ROWS_PER_STATEMENT) {
    const json = JSON.stringify(table.rows.slice(i, i + ROWS_PER_STATEMENT));
    const tag = dollarTag(json);
    parts.push(`insert into ${t} (${cols}) select ${cols} from json_populate_recordset(null::${t}, ${tag}${json}${tag});`);
  }
  return parts.join("\n") + "\n";
}

export function buildDataSql(tables: BackupTableData[], meta: { createdAt: string; lastMigration: string; appVersion: string }): string {
  const head = [
    "-- Mindfreak Manager · copia de seguridad (solo datos)",
    `-- Creada: ${meta.createdAt} · Versión ${meta.appVersion} · Estructura hasta la migración ${meta.lastMigration}`,
    "-- Se restaura sobre una base que ya tiene la estructura (migraciones 001 a la indicada). Ver LEEME-RESTAURAR.txt.",
    "\\set ON_ERROR_STOP on",
    "begin;",
    "set session_replication_role = replica;",
    "",
  ].join("\n");
  const body = tables.map(tableInsertSql).join("\n");
  const tail = ["", "set session_replication_role = origin;", "commit;", ""].join("\n");
  return head + body + tail;
}
