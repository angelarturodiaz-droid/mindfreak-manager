"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserCompanyIds, hasPermission } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { IDLE_OPTIONS } from "@/lib/session/idle";

/** Configuración → Seguridad: minutos sin usar el sistema antes de cerrar la sesión. */
export async function updateIdleTimeoutAction(minutes: number): Promise<{ error: string | null }> {
  if (!(await hasPermission("settings.manage"))) return { error: "Solo Administración puede cambiar esto." };
  if (!(IDLE_OPTIONS as readonly number[]).includes(minutes)) return { error: "Elige uno de los tiempos de la lista." };
  const [companyId] = await getCurrentUserCompanyIds();
  const supabase = await createClient();
  const { data: before } = await supabase.from("companies").select("idle_timeout_minutes").eq("id", companyId).single();
  const { error } = await supabase.from("companies").update({ idle_timeout_minutes: minutes }).eq("id", companyId);
  if (error) return { error: "No se pudo guardar. Inténtalo de nuevo." };
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "company",
    entityId: companyId,
    oldValues: { idle_timeout_minutes: before?.idle_timeout_minutes ?? null },
    newValues: { idle_timeout_minutes: minutes },
  });
  revalidatePath("/", "layout");
  return { error: null };
}
