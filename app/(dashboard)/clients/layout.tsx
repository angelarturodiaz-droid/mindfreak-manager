import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso clients.view (si no, vuelve al inicio con un aviso). */
export default async function ClientsAccessLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("clients.view", "entrar a Clientes");
  return children;
}
