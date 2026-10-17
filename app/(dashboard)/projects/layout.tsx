import { requirePageAccess } from "@/lib/auth/permissions";

/** Solo entra quien tiene el permiso projects.view (si no, vuelve al inicio con un aviso). */
export default async function ProjectsAccessLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("projects.view", "entrar a Proyectos");
  return children;
}
