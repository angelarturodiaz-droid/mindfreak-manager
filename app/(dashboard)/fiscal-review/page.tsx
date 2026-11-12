import { requirePageAccess } from "@/lib/auth/permissions";
import { FiscalRulesList, type FiscalRulesSearch } from "@/components/fiscal/rules-list";

/**
 * Revisión fiscal: la pantalla del contador (rol «Contador (revisión fiscal)», permiso fiscal_rules.review).
 * Ve las reglas, prueba casos y las marca como revisadas. No puede crear, editar, activar ni borrar.
 */
export default async function FiscalReviewPage({ searchParams }: { searchParams: Promise<FiscalRulesSearch> }) {
  await requirePageAccess("fiscal_rules.review", "Revisión fiscal");
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <FiscalRulesList params={await searchParams} basePath="/fiscal-review" canManage={false} />
    </main>
  );
}
