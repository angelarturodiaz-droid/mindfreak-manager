#!/usr/bin/env node
// Vuelve a subir los documentos de una copia a Supabase Storage, en la misma ruta (reemplaza si existe).
// Uso (en tu Mac, nunca en GitHub):
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SECRET_KEY=... node scripts/backup/restore-storage.mjs <carpeta>
// La llave de servicio solo se escribe en la Terminal en el momento; no se guarda en el proyecto.
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const dir = process.argv[2];
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!dir || !url || !key) {
  console.error("Uso: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/backup/restore-storage.mjs <carpeta>");
  process.exit(2);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });
const root = join(dir, "storage");
const buckets = readdirSync(root);
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
const mimeOf = new Map(manifest.files.map((f) => [f.path, f.mime]));

function walk(p) {
  return statSync(p).isDirectory() ? readdirSync(p).flatMap((n) => walk(join(p, n))) : [p];
}

let ok = 0;
for (const bucket of buckets) {
  const { error: bErr } = await supabase.storage.createBucket(bucket, { public: false });
  if (bErr && !/already exists/i.test(bErr.message)) console.warn(`Aviso con el bucket ${bucket}: ${bErr.message}`);
  for (const file of walk(join(root, bucket))) {
    const path = relative(join(root, bucket), file).split("\\").join("/");
    const { error } = await supabase.storage.from(bucket).upload(path, readFileSync(file), {
      upsert: true,
      contentType: mimeOf.get(`storage/${bucket}/${path}`) ?? undefined,
    });
    if (error) console.error(`✗ ${bucket}/${path}: ${error.message}`);
    else ok++;
  }
}
console.log(`✓ ${ok} documentos subidos.`);
