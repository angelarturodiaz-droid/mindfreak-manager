#!/usr/bin/env node
// Revisa una copia descomprimida: cada archivo existe y su huella SHA-256 coincide con manifest.json.
// Uso: node scripts/backup/verify-backup.mjs <carpeta descomprimida>
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("Uso: node scripts/backup/verify-backup.mjs <carpeta descomprimida>");
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
let bad = 0;
for (const f of manifest.files) {
  const p = join(dir, f.path);
  if (!existsSync(p)) {
    console.error(`✗ Falta: ${f.path}`);
    bad++;
    continue;
  }
  const data = readFileSync(p);
  const sha = createHash("sha256").update(data).digest("hex");
  if (sha !== f.sha256 || data.length !== f.size) {
    console.error(`✗ No coincide: ${f.path}`);
    bad++;
  }
}
console.log(`Copia del ${manifest.startedAt} · ${manifest.kind} · estructura hasta la migración ${manifest.app.lastMigration}`);
console.log(`${manifest.files.length} archivos revisados · ${manifest.database.tables.length} tablas · ${manifest.database.totalRows} filas`);
if (bad) {
  console.error(`✗ ${bad} archivo(s) con problemas: NO uses esta copia.`);
  process.exit(1);
}
console.log("✓ Todo coincide con el manifest.");
