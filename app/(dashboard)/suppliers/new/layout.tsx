import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso suppliers.create (si no, vuelve al inicio con un aviso). */
export default async function SuppliersNewLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("suppliers.create", "crear en Proveedores");
  return children;
}
