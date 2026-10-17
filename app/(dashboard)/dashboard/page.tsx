import Link from "next/link";
import { Settings2, Plus } from "lucide-react";
import { Suspense } from "react";
import { getCurrentUser, getCurrentUserCompanyIds, getMyPermissions } from "@/lib/auth/permissions";
import { NoPermissionNotice } from "./no-permission-notice";
import { getUserDashboardWidgets } from "@/features/dashboard-widgets/queries";
import { getDashboardWidgetBundle } from "@/features/dashboard-widgets/bundle";
import { PANEL_COLS, widgetKind } from "@/features/dashboard-widgets/registry";
import { renderWidget } from "@/components/dashboard-widgets/render-widget";
import { Button } from "@/components/ui/button";

const QUICK_ACTIONS = [
  { href: "/quotations/new", label: "Cotización", perm: "quotations.create" },
  { href: "/clients/new", label: "Cliente", perm: "clients.create" },
  { href: "/invoices/new", label: "Factura", perm: "invoices.create" },
  { href: "/expenses/new", label: "Gasto", perm: "expenses.create" },
];

export default async function DashboardPage() {
  const [user, companyIds, perms] = await Promise.all([getCurrentUser(), getCurrentUserCompanyIds(), getMyPermissions()]);
  const companyId = companyIds[0];

  const [widgets, bundle] = await Promise.all([
    user && companyId ? getUserDashboardWidgets(user.id, companyId) : Promise.resolve([]),
    getDashboardWidgetBundle(),
  ]);

  const visibleWidgets = widgets.filter((w) => w.visible);
  // Dos zonas, cada una en el orden elegido en Personalizar:
  // indicadores compactos arriba y paneles (gráficos y listas) debajo.
  const kpis = visibleWidgets.filter((w) => widgetKind(w.type) === "kpi");
  const panels = visibleWidgets.filter((w) => widgetKind(w.type) === "panel");

  return (
    <main className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <Suspense fallback={null}>
        <NoPermissionNotice />
      </Suspense>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Dashboard</h1>
          <p className="text-sm text-brand-muted">Sesión activa: {user?.email ?? "—"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Solo los atajos que su rol le permite usar. */}
          {QUICK_ACTIONS.filter((a) => perms.has(a.perm)).map((action) => (
            <Link key={action.href} href={action.href}>
              <Button variant="outline" size="sm" icon={<Plus size={14} />}>
                {action.label}
              </Button>
            </Link>
          ))}
          <Link href="/dashboard/customize">
            <Button variant="ghost" size="sm" icon={<Settings2 size={14} />}>
              Personalizar
            </Button>
          </Link>
        </div>
      </div>

      {visibleWidgets.length === 0 && (
        <p className="text-sm text-brand-muted">
          No tienes widgets visibles.{" "}
          <Link href="/dashboard/customize" className="text-brand-accent hover:underline">
            Personaliza tu Dashboard
          </Link>{" "}
          para agregar algunos.
        </p>
      )}

      {kpis.length > 0 && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {kpis.map((w) => (
            <div key={w.type} className="min-w-0">
              {renderWidget(w.type, bundle)}
            </div>
          ))}
        </section>
      )}

      {panels.length > 0 && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {panels.map((w) => (
            <div key={w.type} className={`min-w-0 ${PANEL_COLS[w.size]}`}>
              {renderWidget(w.type, bundle)}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
