/**
 * A0 — Arma el ZIP del respaldo EN EL NAVEGADOR (fflate, en partes) y lo guarda en la computadora del usuario.
 * En Chrome/Edge se escribe directo al disco mientras se arma («Guardar como…»); en Safari/Firefox se arma en memoria
 * y se descarga al final (hoy son pocos MB). Calcula la huella SHA-256 de cada archivo para el manifest.
 */
import { Zip, ZipDeflate, ZipPassThrough } from "fflate";
import { exportTablePageAction, signFilesAction, type BackupFileInfo, type BackupTableInfo } from "./actions";
import { buildDataSql, type BackupTableData } from "./sql";
import { EXCLUDED_TABLES, README_RESTORE, backupFileName, buildManifest, type ManifestFile } from "./manifest";
import { LAST_MIGRATION } from "./version";

export type BackupProgress = { stage: "db" | "files" | "zip"; done: number; total: number; label: string };

export type BackupPlan = {
  runId: string;
  kind: "FULL" | "DB_ONLY";
  tables: BackupTableInfo[];
  files: BackupFileInfo[];
  users: unknown[];
  controlTotals: Record<string, unknown>;
  schemaSnapshot: string;
  startedAt: string;
  appVersion: string;
  environment: string;
};

export type BackupResult = { fileName: string; sizeBytes: number; manifestSha256: string; tableCount: number; rowCount: number; fileCount: number };

const enc = new TextEncoder();
const PAGE = 1000;

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

type Sink = { write: (chunk: Uint8Array) => Promise<void>; close: () => Promise<void>; size: () => number };

/** Dónde se escribe el ZIP: directo al disco (Chrome/Edge) o en memoria (los demás). */
async function openSink(fileName: string): Promise<Sink> {
  const w = window as unknown as {
    showSaveFilePicker?: (o: unknown) => Promise<{ createWritable: () => Promise<{ write: (d: Uint8Array) => Promise<void>; close: () => Promise<void> }> }>;
  };
  let written = 0;
  if (typeof w.showSaveFilePicker === "function") {
    const handle = await w.showSaveFilePicker({
      suggestedName: fileName,
      types: [{ description: "Copia de seguridad (ZIP)", accept: { "application/zip": [".zip"] } }],
    });
    const stream = await handle.createWritable();
    return {
      write: async (c) => {
        written += c.length;
        await stream.write(c);
      },
      close: () => stream.close(),
      size: () => written,
    };
  }
  const parts: Uint8Array[] = [];
  return {
    write: async (c) => {
      written += c.length;
      parts.push(c);
    },
    close: async () => {
      const blob = new Blob(parts as BlobPart[], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    size: () => written,
  };
}

export async function buildBackupZip(plan: BackupPlan, onProgress: (p: BackupProgress) => void): Promise<BackupResult> {
  const fileName = backupFileName(new Date(plan.startedAt));
  const sink = await openSink(fileName);

  // fflate entrega el ZIP en partes; las escribimos en orden.
  let pending: Promise<void> = Promise.resolve();
  let zipError: Error | null = null;
  let finished!: () => void;
  const done = new Promise<void>((r) => (finished = r));
  const zip = new Zip((err, chunk, final) => {
    if (err) {
      zipError = err;
      finished();
      return;
    }
    pending = pending.then(() => sink.write(chunk));
    if (final) pending.then(() => finished());
  });

  const manifestFiles: ManifestFile[] = [];
  async function addFile(path: string, data: Uint8Array, compress = true) {
    manifestFiles.push({ path, size: data.length, sha256: await sha256Hex(data) });
    const entry = compress ? new ZipDeflate(path, { level: 6 }) : new ZipPassThrough(path);
    zip.add(entry);
    entry.push(data, true);
    await pending;
  }

  // 1. Base de datos, tabla por tabla.
  const tablesData: BackupTableData[] = [];
  let rowCount = 0;
  for (let i = 0; i < plan.tables.length; i++) {
    const t = plan.tables[i];
    onProgress({ stage: "db", done: i, total: plan.tables.length, label: `Base de datos: ${t.name}` });
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; offset < Math.max(t.rows, 1); offset += PAGE) {
      const res = await exportTablePageAction(t.name, offset, PAGE);
      if (res.error) throw new Error(`No se pudo leer «${t.name}»: ${res.error}`);
      rows.push(...res.rows);
      if (res.rows.length < PAGE) break;
    }
    rowCount += rows.length;
    tablesData.push({ name: t.name, columns: t.columns, rows });
    await addFile(`database/tables/${t.name}.json`, enc.encode(JSON.stringify(rows, null, 1)));
  }
  onProgress({ stage: "db", done: plan.tables.length, total: plan.tables.length, label: "Base de datos lista" });
  await addFile(
    "database/data.sql",
    enc.encode(buildDataSql(tablesData, { createdAt: plan.startedAt, lastMigration: LAST_MIGRATION, appVersion: plan.appVersion })),
  );
  await addFile("database/auth-users.json", enc.encode(JSON.stringify(plan.users, null, 1)));
  await addFile("database/estructura-tablas.sql", enc.encode(plan.schemaSnapshot));

  // 2. Documentos (direcciones firmadas de 5 minutos, de 20 en 20).
  let fileBytes = 0;
  for (let i = 0; i < plan.files.length; i += 20) {
    const batch = plan.files.slice(i, i + 20);
    const signed = await signFilesAction(batch.map((f) => f.path));
    if (signed.error) throw new Error(`No se pudieron preparar los documentos: ${signed.error}`);
    for (let j = 0; j < batch.length; j++) {
      const f = batch[j];
      onProgress({ stage: "files", done: i + j, total: plan.files.length, label: `Documentos: ${f.path.split("/").pop()}` });
      const url = signed.urls[f.path];
      if (!url) throw new Error(`No se pudo preparar «${f.path}».`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`No se pudo bajar «${f.path}» (${res.status}).`);
      const data = new Uint8Array(await res.arrayBuffer());
      fileBytes += data.length;
      // Los PDF e imágenes ya vienen comprimidos: se guardan tal cual.
      await addFile(`storage/documents/${f.path}`, data, false);
    }
  }
  if (plan.files.length) onProgress({ stage: "files", done: plan.files.length, total: plan.files.length, label: "Documentos listos" });

  // 3. Instrucciones y manifest (el manifest no se lista a sí mismo).
  onProgress({ stage: "zip", done: 0, total: 1, label: "Cerrando el archivo…" });
  await addFile("LEEME-RESTAURAR.txt", enc.encode(README_RESTORE));
  const manifest = buildManifest({
    kind: plan.kind,
    app: { name: "Mindfreak Manager", version: plan.appVersion, lastMigration: LAST_MIGRATION, environment: plan.environment },
    database: {
      postgres: "17",
      tables: tablesData.map((t) => ({ name: t.name, rows: t.rows.length })),
      totalRows: rowCount,
      excludedTables: EXCLUDED_TABLES,
    },
    storage: plan.kind === "FULL" ? { buckets: ["documents"], files: plan.files.length, bytes: fileBytes } : null,
    controlTotals: plan.controlTotals,
    startedAt: plan.startedAt,
    finishedAt: new Date().toISOString(),
    files: manifestFiles,
  });
  const manifestBytes = enc.encode(JSON.stringify(manifest, null, 2));
  const manifestSha256 = await sha256Hex(manifestBytes);
  const entry = new ZipDeflate("manifest.json", { level: 6 });
  zip.add(entry);
  entry.push(manifestBytes, true);
  zip.end();
  await done;
  await pending;
  if (zipError) throw zipError;
  await sink.close();
  onProgress({ stage: "zip", done: 1, total: 1, label: "Listo" });

  return {
    fileName,
    sizeBytes: sink.size(),
    manifestSha256,
    tableCount: tablesData.length,
    rowCount,
    fileCount: plan.files.length,
  };
}
