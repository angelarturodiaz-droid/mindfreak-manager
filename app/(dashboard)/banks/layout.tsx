import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso banks.view (si no, vuelve al inicio con un aviso). */
export default async function BanksAccessLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("banks.view", "entrar a Bancos");
  return children;
}
