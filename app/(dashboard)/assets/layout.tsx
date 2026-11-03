import { requirePageAccess } from "@/lib/auth/permissions";

export default async function AssetsAccessLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("assets.view", "entrar a Activos");
  return children;
}
