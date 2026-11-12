import { FiscalRulesList, type FiscalRulesSearch } from "@/components/fiscal/rules-list";

/** Configuración → Reglas fiscales (Administración: puede crear, editar, activar y borrar). */
export default async function FiscalRulesPage({ searchParams }: { searchParams: Promise<FiscalRulesSearch> }) {
  return <FiscalRulesList params={await searchParams} basePath="/settings/fiscal-rules" canManage />;
}
