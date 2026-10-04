import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listFiscalClassifications } from "@/features/fiscal/classification-queries";
import { RuleWizard } from "@/components/fiscal/rule-wizard";

export default async function NewFiscalRulePage() {
  const classifications = await listFiscalClassifications();
  return (
    <div className="flex flex-col gap-4">
      <Link href="/settings/fiscal-rules" className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text">
        <ArrowLeft size={14} /> Reglas fiscales
      </Link>
      <div>
        <h2 className="text-lg font-semibold text-brand-primary">Nueva regla fiscal</h2>
        <p className="text-sm text-brand-muted">Te guiamos en 6 pasos. Puedes moverte entre pasos con los botones o haciendo clic arriba.</p>
      </div>
      <RuleWizard classifications={classifications} />
    </div>
  );
}
