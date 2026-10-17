import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso invoices.view (si no, vuelve al inicio con un aviso). */
export default async function InvoicesAccessLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("invoices.view", "entrar a Facturas");
  return children;
}
