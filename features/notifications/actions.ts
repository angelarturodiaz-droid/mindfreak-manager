"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { countUnreadNotifications, listMyNotifications } from "./queries";

export async function markNotificationReadAction(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión no encontrada.");

  // Filtro explícito por user_id además de RLS (defensa en profundidad):
  // sin esto, cualquier usuario autenticado podía marcar como leída la
  // notificación de otro usuario con solo adivinar/enumerar su id.
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión no encontrada.");

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

/**
 * La campanita se revisa sola (cada 30 s con la pestaña visible): devuelve
 * los últimos avisos y cuántos faltan por leer. Solo lectura.
 */
export async function getMyNotificationsAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { notifications: [], unreadCount: 0 };
  const [notifications, unreadCount] = await Promise.all([listMyNotifications(), countUnreadNotifications()]);
  return { notifications: notifications ?? [], unreadCount };
}
