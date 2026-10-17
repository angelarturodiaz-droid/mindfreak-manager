import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso quotations.create (si no, vuelve al inicio con un aviso). */
export default async function QuotationsNewLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("quotations.create", "crear en Cotizaciones");
  return children;
}
