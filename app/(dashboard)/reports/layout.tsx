import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso reports.view (si no, vuelve al inicio con un aviso). */
export default async function ReportsAccessLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("reports.view", "entrar a Reportes");
  return children;
}
