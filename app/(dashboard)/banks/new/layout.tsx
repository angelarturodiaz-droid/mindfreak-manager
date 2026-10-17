import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso banks.create (si no, vuelve al inicio con un aviso). */
export default async function BanksNewLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("banks.create", "crear en Bancos");
  return children;
}
