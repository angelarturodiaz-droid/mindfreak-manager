import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso clients.create (si no, vuelve al inicio con un aviso). */
export default async function ClientsNewLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("clients.create", "crear en Clientes");
  return children;
}
