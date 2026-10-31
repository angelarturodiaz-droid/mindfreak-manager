import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, pageRange } from "@/lib/utils/pagination";
import type { CorrectionAction, CorrectionStatus, CorrectionTargetType } from "./schema";

export type CorrectionRow = {
  id: string;
  target_type: CorrectionTargetType;
  target_id: string;
  target_label: string;
  action: CorrectionAction;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  reason: string;
  status: CorrectionStatus;
  requested_by: string;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  link_type: string | null;
  link_id: string | null;
  requesterName: string;
  deciderName: string | null;
};

const SELECT =
  "id, target_type, target_id, target_label, action, old_values, new_values, reason, status, requested_by, requested_at, decided_by, decided_at, decision_note, link_type, link_id";

async function withNames(rows: Omit<CorrectionRow, "requesterName" | "deciderName">[]): Promise<CorrectionRow[]> {
  const ids = [...new Set(rows.flatMap((r) => [r.requested_by, r.decided_by]).filter(Boolean) as string[])];
  const names = new Map<string, string>();
  if (ids.length) {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of data ?? []) names.set(p.id, p.full_name || p.email || "Usuario");
  }
  return rows.map((r) => ({
    ...r,
    requesterName: names.get(r.requested_by) ?? "Usuario",
    deciderName: r.decided_by ? (names.get(r.decided_by) ?? "Usuario") : null,
  }));
}

/** Solicitudes pendientes (todas: suelen ser pocas), lo último primero. */
export async function listPendingCorrections(): Promise<CorrectionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_correction_requests")
    .select(SELECT)
    .eq("status", "PENDING")
    .order("requested_at", { ascending: false });
  if (error) throw new Error(error.message);
  return withNames((data ?? []) as Omit<CorrectionRow, "requesterName" | "deciderName">[]);
}

/** Historial (ya decididas o retiradas), paginado, lo último primero. */
export async function listCorrectionHistory(page = 1) {
  const supabase = await createClient();
  const [from, to] = pageRange(page);
  const { data, error, count } = await supabase
    .from("payment_correction_requests")
    .select(SELECT, { count: "exact" })
    .neq("status", "PENDING")
    .order("requested_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return {
    rows: await withNames((data ?? []) as Omit<CorrectionRow, "requesterName" | "deciderName">[]),
    total: count ?? 0,
    pageSize: PAGE_SIZE,
  };
}

export async function countPendingCorrections(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("payment_correction_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "PENDING");
  return count ?? 0;
}

/** Ids (de cobros, pagos o movimientos) que tienen una corrección pendiente. */
export async function pendingTargetIds(targetType: CorrectionTargetType, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_correction_requests")
    .select("target_id")
    .eq("target_type", targetType)
    .eq("status", "PENDING")
    .in("target_id", ids);
  return new Set((data ?? []).map((r) => r.target_id as string));
}
