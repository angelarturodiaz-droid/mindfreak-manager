import { redirect } from "next/navigation";

/** La antigua página de "Notificaciones" ahora es Configuración → Recordatorios. */
export default function NotificationsSettingsPage() {
  redirect("/settings/reminders");
}
