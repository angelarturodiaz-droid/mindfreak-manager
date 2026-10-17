import { redirect } from "next/navigation";
import { getMyPermissions } from "@/lib/auth/permissions";
import { canSeeComparisons } from "@/features/reports/access";

/** Comparaciones muestra rentabilidad: requiere ver reportes, facturas y gastos. */
export default async function ComparisonsAccessLayout({ children }: { children: React.ReactNode }) {
  if (!canSeeComparisons(await getMyPermissions())) {
    redirect(`/dashboard?sin_permiso=${encodeURIComponent("entrar a Comparaciones")}`);
  }
  return children;
}
