import { FiscalRuleDetail } from "@/components/fiscal/rule-detail";

/** Configuración → Reglas fiscales → una regla (Administración). */
export default async function FiscalRuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FiscalRuleDetail id={id} basePath="/settings/fiscal-rules" canManage />;
}
