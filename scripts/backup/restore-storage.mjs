#!/usr/bin/env node
/**
 * Restaura los archivos de una carpeta local (generada por
 * backup-storage.mjs) de vuelta a Supabase Storage. Crea los buckets que
 * falten (todos PRIVADOS por defecto — si alguno debía ser público, hay
 * que marcarlo a mano después, igual que se hizo en la auditoría de
 * seguridad).
 *
 * Uso: node restore-storage.mjs <carpeta-origen>
 * Env requeridas: SUPABASE_URL, SUPABASE_SECRET_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const srcDir = process.argv[2];
if (!srcDir) {
  console.error("Uso: node restore-storage.mjs <carpeta-origen>");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Faltan las variables de entorno SUPABASE_URL / SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function walk(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full, base)));
    } else {
      files.push(path.relative(base, full));
    }
  }
  return files;
}

async function ensureBucket(name) {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.name === name)) return;
  console.log(`Creando bucket faltante (privado): ${name}`);
  const { error } = await supabase.storage.createBucket(name, { public: false });
  if (error) throw new Error(`No se pudo crear el bucket ${name}: ${error.message}`);
}

async function main() {
  const bucketDirs = await readdir(srcDir, { withFileTypes: true });
  let totalFiles = 0;

  for (const bucketDir of bucketDirs) {
    if (!bucketDir.isDirectory()) continue;
    const bucketName = bucketDir.name;
    await ensureBucket(bucketName);

    const bucketPath = path.join(srcDir, bucketName);
    const relativeFiles = await walk(bucketPath);
    console.log(`Bucket ${bucketName}: subiendo ${relativeFiles.length} archivo(s)`);

    for (const relPath of relativeFiles) {
      const localFile = path.join(bucketPath, relPath);
      const buffer = await readFile(localFile);
      const storagePath = relPath.split(path.sep).join("/");
      const { error } = await supabase.storage.from(bucketName).upload(storagePath, buffer, { upsert: true });
      if (error) {
        console.error(`  ! No se pudo subir ${bucketName}/${storagePath}: ${error.message}`);
        continue;
      }
      totalFiles++;
    }
  }

  console.log(`Listo — ${totalFiles} archivo(s) restaurado(s) desde ${srcDir}`);
}

main().catch((e) => {
  console.error("restore-storage.mjs falló:", e);
  process.exit(1);
});
