import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getFiscalRule, countRuleUsage } from "@/features/fiscal/rule-queries";
import { listFiscalClassifications } from "@/features/fiscal/classification-queries";
import { RuleWizard } from "@/components/fiscal/rule-wizard";

export default async function EditFiscalRulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rule, classifications, used] = await Promise.all([getFiscalRule(id), listFiscalClassifications(), countRuleUsage(id)]);
  if (!rule) notFound();
  return (
    <div className="flex flex-col gap-4">
      <Link href={`/settings/fiscal-rules/${id}`} className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text">
        <ArrowLeft size={14} /> {rule.name}
      </Link>
      <div>
        <h2 className="text-lg font-semibold text-brand-primary">Editar regla fiscal</h2>
        <p className="text-sm text-brand-muted">
          {used > 0
            ? `Esta regla ya se usó en ${used} gasto(s): al guardar se crea una nueva versión con la fecha que indiques en el paso 5.`
            : "Esta regla aún no se ha usado en ningún gasto: los cambios se guardan sobre ella. Si cambió la ley, marca “nueva versión” en el paso 5."}
        </p>
      </div>
      <RuleWizard rule={rule} classifications={classifications} usedCount={used} />
    </div>
  );
}
