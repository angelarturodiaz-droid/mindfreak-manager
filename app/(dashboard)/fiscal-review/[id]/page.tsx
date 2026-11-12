import { requirePageAccess } from "@/lib/auth/permissions";
import { FiscalRuleDetail } from "@/components/fiscal/rule-detail";

/** Revisión fiscal → una regla (contador: solo ver y «Marcar como revisada»). */
export default async function FiscalReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess("fiscal_rules.review", "Revisión fiscal");
  const { id } = await params;
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <FiscalRuleDetail id={id} basePath="/fiscal-review" canManage={false} />
    </main>
  );
}
