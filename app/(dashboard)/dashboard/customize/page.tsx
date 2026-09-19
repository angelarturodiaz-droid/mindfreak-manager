import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { getUserDashboardWidgets } from "@/features/dashboard-widgets/queries";
import { WIDGET_REGISTRY, type WidgetInstance } from "@/features/dashboard-widgets/registry";
import { DashboardCustomizer } from "./dashboard-customizer";

export default async function CustomizeDashboardPage() {
  const [user, companyIds] = await Promise.all([getCurrentUser(), getCurrentUserCompanyIds()]);
  if (!user) redirect("/login");
  const companyId = companyIds[0];
  if (!companyId) redirect("/dashboard");

  const saved = await getUserDashboardWidgets(user.id, companyId);

  // Cualquier widget del catálogo que el usuario todavía no tenga en su
  // lista (ej. uno agregado después) aparece al final, oculto por
  // defecto — así el catálogo puede crecer sin romper configuraciones ya
  // guardadas.
  const savedTypes = new Set(saved.map((w) => w.type));
  const missing: WidgetInstance[] = WIDGET_REGISTRY.filter((w) => !savedTypes.has(w.type)).map((w) => ({
    type: w.type,
    visible: false,
    size: w.defaultSize,
  }));

  const initialWidgets = [...saved, ...missing];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">
          Personalizar Dashboard
        </h1>
      </div>
      <DashboardCustomizer initialWidgets={initialWidgets} />
    </main>
  );
}
