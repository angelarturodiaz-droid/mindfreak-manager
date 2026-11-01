import { requirePageAccess } from "@/lib/auth/permissions";

/** Mismo permiso que Proveedores (el Directorio es parte de Proveedores). */
export default async function DirectoryAccessLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("suppliers.view", "entrar al Directorio");
  return children;
}
