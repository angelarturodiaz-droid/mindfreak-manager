import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso deliveries.view (si no, vuelve al inicio con un aviso). */
export default async function DeliveriesAccessLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("deliveries.view", "entrar a Entregas y acuses");
  return children;
}
