import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso expenses.view (si no, vuelve al inicio con un aviso). */
export default async function ExpensesAccessLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("expenses.view", "entrar a Gastos");
  return children;
}
