import { redirect } from "next/navigation";
import { getMyPermissions } from "@/lib/auth/permissions";
import { allowedReports } from "@/features/reports/access";

/** Solo entra quien tiene al menos un reporte de su rol (si no, vuelve al inicio con un aviso). */
export default async function ReportsAccessLayout({ children }: { children: React.ReactNode }) {
  if (allowedReports(await getMyPermissions()).length === 0) {
    redirect(`/dashboard?sin_permiso=${encodeURIComponent("entrar a Reportes")}`);
  }
  return children;
}
