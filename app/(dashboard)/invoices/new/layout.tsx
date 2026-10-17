import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso invoices.create (si no, vuelve al inicio con un aviso). */
export default async function InvoicesNewLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("invoices.create", "crear en Facturas");
  return children;
}
