import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso expenses.create (si no, vuelve al inicio con un aviso). */
export default async function ExpensesNewLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("expenses.create", "crear en Gastos");
  return children;
}
