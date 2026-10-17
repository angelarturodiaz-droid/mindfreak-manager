import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso projects.create (si no, vuelve al inicio con un aviso). */
export default async function ProjectsNewLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("projects.create", "crear en Proyectos");
  return children;
}
