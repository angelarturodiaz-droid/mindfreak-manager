import { requirePageAccess } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { APP_VERSION, environmentLabel } from "@/lib/app-info";
import { BackupPanel, type BackupRunRow } from "./backup-panel";

export default async function BackupsPage() {
  await requirePageAccess("backups.create", "Copias de seguridad");
  const supabase = await createClient();
  const { data } = await supabase
    .from("backup_runs")
    .select("id, kind, status, started_at, finished_at, size_bytes, table_count, row_count, file_count, error, profiles:started_by(full_name)")
    .order("started_at", { ascending: false })
    .limit(10);

  const runs: BackupRunRow[] = (data ?? []).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      kind: r.kind,
      status: r.status,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      sizeBytes: r.size_bytes,
      tableCount: r.table_count,
      rowCount: r.row_count,
      fileCount: r.file_count,
      error: r.error,
      by: (p as { full_name?: string } | null)?.full_name ?? "—",
    };
  });

  return <BackupPanel runs={runs} appVersion={APP_VERSION} environment={environmentLabel()} />;
}
