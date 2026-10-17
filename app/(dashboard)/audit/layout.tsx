import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso settings.manage (si no, vuelve al inicio con un aviso). */
export default async function AuditAccessLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("settings.manage", "entrar a Auditoría");
  return children;
}
