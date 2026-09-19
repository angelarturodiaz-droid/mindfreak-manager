import Link from "next/link";
import { Settings2, Plus } from "lucide-react";
import { getCurrentUser, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { getUserDashboardWidgets } from "@/features/dashboard-widgets/queries";
import { getDashboardWidgetBundle } from "@/features/dashboard-widgets/bundle";
import { SIZE_COLS } from "@/features/dashboard-widgets/registry";
import { renderWidget } from "@/components/dashboard-widgets/render-widget";
import { Button } from "@/components/ui/button";

const QUICK_ACTIONS = [
  { href: "/quotations/new", label: "Nueva cotización" },
  { href: "/clients/new", label: "Nuevo cliente" },
  { href: "/invoices/new", label: "Nueva factura" },
  { href: "/expenses/new", label: "Nuevo gasto" },
];

export default async function DashboardPage() {
  const [user, companyIds] = await Promise.all([getCurrentUser(), getCurrentUserCompanyIds()]);
  const companyId = companyIds[0];

  const [widgets, bundle] = await Promise.all([
    user && companyId ? getUserDashboardWidgets(user.id, companyId) : Promise.resolve([]),
    getDashboardWidgetBundle(),
  ]);

  const visibleWidgets = widgets.filter((w) => w.visible);

  return (
    <main className="flex flex-1 flex-col gap-8 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Dashboard</h1>
          <p className="text-sm text-brand-muted">
            Sesión activa: {user?.email ?? "—"}
          </p>
        </div>
        <Link href="/dashboard/customize">
          <Button variant="outline" size="sm" icon={<Settings2 size={14} />}>
            Personalizar Dashboard
          </Button>
        </Link>
      </div>

      <section className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href}>
            <Button variant="outline" size="sm" icon={<Plus size={14} />}>
              {action.label}
            </Button>
          </Link>
        ))}
      </section>

      {visibleWidgets.length === 0 ? (
        <p className="text-sm text-brand-muted">
          No tienes widgets visibles.{" "}
          <Link href="/dashboard/customize" className="text-brand-accent hover:underline">
            Personaliza tu Dashboard
          </Link>{" "}
          para agregar algunos.
        </p>
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visibleWidgets.map((w, i) => (
            <div key={`${w.type}-${i}`} className={SIZE_COLS[w.size]}>
              {renderWidget(w.type, bundle)}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
