import { requirePageAccess } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { GoLivePanel, type GoLiveRunRow } from "./golive-panel";

export default async function GoLivePage() {
  await requirePageAccess("golive.manage", "Preparar Go-Live");
  const supabase = await createClient();

  const [envRes, runsRes, backupRes, companyRes] = await Promise.all([
    supabase.from("system_environment").select("environment, go_live_at, cleanup_locked").maybeSingle(),
    supabase
      .from("golive_cleanup_runs")
      .select("id, status, counts, files, files_left, created_at, finished_at, profiles:run_by(full_name)")
      .eq("mode", "EXECUTE")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("backup_runs")
      .select("started_at")
      .eq("kind", "FULL")
      .eq("status", "COMPLETADO")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("companies").select("name").limit(1).maybeSingle(),
  ]);

  const runs: GoLiveRunRow[] = (runsRes.data ?? []).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const counts = (Array.isArray(r.counts) ? r.counts : []) as { count?: number }[];
    return {
      id: r.id,
      status: r.status,
      createdAt: r.created_at,
      finishedAt: r.finished_at,
      records: counts.reduce((s, c) => s + Number(c.count ?? 0), 0),
      files: Array.isArray(r.files) ? r.files.length : 0,
      filesLeft: r.files_left ?? 0,
      by: (p as { full_name?: string } | null)?.full_name ?? "—",
    };
  });

  return (
    <GoLivePanel
      environment={envRes.data?.environment ?? "PRODUCTION"}
      goLiveAt={envRes.data?.go_live_at ?? null}
      locked={envRes.data?.cleanup_locked ?? false}
      lastBackupAt={backupRes.data?.started_at ?? null}
      companyName={companyRes.data?.name ?? ""}
      runs={runs}
    />
  );
}
