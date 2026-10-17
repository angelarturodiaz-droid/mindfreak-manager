import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso reports.view (si no, vuelve al inicio con un aviso). */
export default async function ComparisonsAccessLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("reports.view", "entrar a Comparaciones");
  return children;
}
