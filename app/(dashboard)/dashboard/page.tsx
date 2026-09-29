import Link from "next/link";
import { Plus } from "lucide-react";
import {
  getCurrentUser,
  getCurrentUserCompanyIds,
} from "@/lib/auth/permissions";
import { getUserDashboardWidgets } from "@/features/dashboard-widgets/queries";
import { getDashboardWidgetBundle } from "@/features/dashboard-widgets/bundle";
import { withMissingWidgets } from "@/features/dashboard-widgets/registry";
import { renderWidget } from "@/components/dashboard-widgets/render-widget";
import { Button } from "@/components/ui/button";
import { DashboardBoard } from "./dashboard-board";

const QUICK_ACTIONS = [
  { href: "/quotations/new", label: "Nueva cotización" },
  { href: "/clients/new", label: "Nuevo cliente" },
  { href: "/invoices/new", label: "Nueva factura" },
  { href: "/expenses/new", label: "Nuevo gasto" },
];

export default async function DashboardPage() {
  const [user, companyIds] = await Promise.all([
    getCurrentUser(),
    getCurrentUserCompanyIds(),
  ]);
  const companyId = companyIds[0];

  const [widgets, bundle] = await Promise.all([
    user && companyId
      ? getUserDashboardWidgets(user.id, companyId)
      : Promise.resolve([]),
    getDashboardWidgetBundle(),
  ]);

  // Todos (también los ocultos) para poder mostrarlos al organizar.
  const allWidgets = withMissingWidgets(widgets);
  const nodes = Object.fromEntries(
    allWidgets.map((w) => [w.type, renderWidget(w.type, bundle)]),
  );

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Dashboard</h1>
        <p className="text-sm text-brand-muted">
          Sesión activa: {user?.email ?? "—"}
        </p>
      </div>

      <DashboardBoard
        widgets={allWidgets}
        nodes={nodes}
        toolbarStart={QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href}>
            <Button variant="outline" size="sm" icon={<Plus size={14} />}>
              {action.label}
            </Button>
          </Link>
        ))}
      />
    </main>
  );
}
