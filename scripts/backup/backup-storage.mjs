#!/usr/bin/env node
/**
 * Descarga TODOS los objetos de TODOS los buckets de Supabase Storage a
 * una carpeta local, espejando bucket/carpeta/archivo. Usa la Secret Key
 * (service_role) para poder leer buckets privados sin depender de RLS.
 *
 * Uso: node backup-storage.mjs <carpeta-destino>
 * Env requeridas: SUPABASE_URL, SUPABASE_SECRET_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const destDir = process.argv[2];
if (!destDir) {
  console.error("Uso: node backup-storage.mjs <carpeta-destino>");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Faltan las variables de entorno SUPABASE_URL / SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

/** Lista recursivamente todos los archivos de un bucket (Storage no tiene un "listar todo" plano). */
async function listAllFiles(bucket, prefix = "") {
  const files = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`Error listando ${bucket}/${prefix}: ${error.message}`);

  for (const entry of data ?? []) {
    // Supabase Storage no distingue carpetas de archivos explícitamente:
    // una "carpeta" es una entrada sin metadata id/tamaño.
    const isFolder = entry.id === null;
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (isFolder) {
      files.push(...(await listAllFiles(bucket, fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) throw new Error(`Error listando buckets: ${bucketsError.message}`);

  let totalFiles = 0;
  for (const bucket of buckets) {
    console.log(`Bucket: ${bucket.name}`);
    const files = await listAllFiles(bucket.name);
    console.log(`  ${files.length} archivo(s)`);

    for (const filePath of files) {
      const { data: blob, error: downloadError } = await supabase.storage.from(bucket.name).download(filePath);
      if (downloadError) {
        console.error(`  ! No se pudo descargar ${bucket.name}/${filePath}: ${downloadError.message}`);
        continue;
      }
      const localPath = path.join(destDir, bucket.name, filePath);
      await mkdir(path.dirname(localPath), { recursive: true });
      const buffer = Buffer.from(await blob.arrayBuffer());
      await writeFile(localPath, buffer);
      totalFiles++;
    }
  }

  console.log(`Listo — ${totalFiles} archivo(s) respaldado(s) en ${destDir}`);
}

main().catch((e) => {
  console.error("backup-storage.mjs falló:", e);
  process.exit(1);
});
