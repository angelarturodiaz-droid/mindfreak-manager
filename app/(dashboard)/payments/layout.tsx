import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso payments.view (si no, vuelve al inicio con un aviso). */
export default async function PaymentsAccessLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("payments.view", "entrar a Cobros y pagos");
  return children;
}
