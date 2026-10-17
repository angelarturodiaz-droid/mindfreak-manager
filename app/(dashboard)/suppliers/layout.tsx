import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso suppliers.view (si no, vuelve al inicio con un aviso). */
export default async function SuppliersAccessLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("suppliers.view", "entrar a Proveedores");
  return children;
}
