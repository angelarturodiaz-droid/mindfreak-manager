import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso deliveries.create (si no, vuelve al inicio con un aviso). */
export default async function DeliveriesNewLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("deliveries.create", "crear en Entregas y acuses");
  return children;
}
