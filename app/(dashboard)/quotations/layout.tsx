import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso quotations.view (si no, vuelve al inicio con un aviso). */
export default async function QuotationsAccessLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("quotations.view", "entrar a Cotizaciones");
  return children;
}
