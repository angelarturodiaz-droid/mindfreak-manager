import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  listExpenseCategories,
  listActiveSuppliers,
  listProjectsForSelect,
  listActiveAccountsForSelect,
} from "@/features/expenses/queries";
import { listBankCatalog } from "@/features/bank-catalog/queries";
import { getCompany } from "@/features/settings/queries";
import { safeReturnTo } from "@/lib/utils/return-to";
import { getAccountFunds } from "@/features/banks/queries";
import { listServiceTypeOptions } from "@/features/supplier-service-types/queries";
import { hasPermission } from "@/lib/auth/permissions";
import { NewExpenseForm } from "./new-expense-form";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string; supplier_id?: string; return_to?: string }>;
}) {
  const params = await searchParams;
  const [categories, suppliers, projects, accounts, bankCatalog, company, funds, serviceTypes, canSeeRules] = await Promise.all([
    listExpenseCategories(),
    listActiveSuppliers(),
    listProjectsForSelect(),
    listActiveAccountsForSelect(),
    listBankCatalog(),
    getCompany(),
    getAccountFunds(),
    listServiceTypeOptions(),
    hasPermission("settings.manage"),
  ]);

  // Gasto creado desde un proyecto o proveedor: se preselecciona y, al
  // guardar o cancelar, se vuelve a esa pantalla.
  const project = projects.find((p) => p.id === params.project_id);
  const supplier = suppliers.find((s) => s.id === params.supplier_id);
  const returnTo = safeReturnTo(params.return_to);
  const backLabel = project
    ? `Proyecto ${project.number} · ${project.name}`
    : supplier
      ? `Proveedor ${supplier.name}`
      : "Gastos";

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link
        href={returnTo ?? "/expenses"}
        className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
      >
        <ArrowLeft size={14} /> {backLabel}
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Nuevo gasto</h1>
        <p className="text-sm text-brand-muted">
          {project
            ? `Se registrará en el proyecto ${project.number} — ${project.name}. Al guardar vuelves al proyecto.`
            : supplier
              ? `Gasto del proveedor ${supplier.name}. Al guardar vuelves al proveedor.`
              : "Puede ser de un proyecto/evento específico o un gasto general de la empresa."}
        </p>
      </div>
      <NewExpenseForm
        categories={categories}
        suppliers={suppliers}
        projects={projects}
        accounts={accounts}
        bankCatalog={bankCatalog}
        baseCurrency={company.base_currency}
        defaultProjectId={project?.id}
        defaultSupplierId={supplier?.id}
        returnTo={returnTo}
        funds={funds}
        serviceTypes={serviceTypes}
        canSeeRules={canSeeRules}
      />
    </main>
  );
}
