import { createClient } from "@/lib/supabase/server";

/**
 * Registra una entrada de auditoría. Reutilizable por cualquier módulo.
 * Ver F0-Arquitectura, sección M (Auditoría).
 *
 * La política RLS de audit_logs exige user_id = auth.uid(), así que esto
 * SIEMPRE registra la acción como hecha por el usuario de la sesión actual
 * (nunca se puede falsificar el autor).
 */
export async function logAudit(params: {
  companyId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return; // no debería pasar (Server Actions ya exigen sesión), pero por si acaso

  const { error } = await supabase.from("audit_logs").insert({
    company_id: params.companyId,
    user_id: user.id,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    old_values: params.oldValues ?? null,
    new_values: params.newValues ?? null,
  });

  if (error) {
    // La auditoría nunca debe tumbar la operación principal; solo se registra el fallo.
    console.error("Error registrando auditoría:", error.message);
  }
}
