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
import { getFxContext, listCurrencyOptions } from "@/features/currencies/queries";
import { safeReturnTo } from "@/lib/utils/return-to";
import { getAccountFunds } from "@/features/banks/queries";
import { listServiceTypeOptions } from "@/features/supplier-service-types/queries";
import { hasPermission } from "@/lib/auth/permissions";
import { NewExpenseForm } from "./new-expense-form";
import { DismissibleTip } from "@/components/ui/dismissible-tip";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string; supplier_id?: string; return_to?: string }>;
}) {
  const params = await searchParams;
  const [categories, suppliers, projects, accounts, bankCatalog, company, funds, serviceTypes, canSeeRules, currencyOptions, fxContext] = await Promise.all([
    listExpenseCategories(),
    listActiveSuppliers(),
    listProjectsForSelect(),
    listActiveAccountsForSelect(),
    listBankCatalog(),
    getCompany(),
    getAccountFunds(),
    listServiceTypeOptions(),
    hasPermission("settings.manage"),
    listCurrencyOptions(),
    getFxContext(),
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
      <DismissibleTip storageKey="gasto.pago-por-partes" title="¿Le vas a pagar al proveedor por partes o adelantarle dinero?">
        <ol className="list-decimal space-y-0.5 pl-5">
          <li>
            Registra aquí el gasto por el <strong>total acordado</strong> (con su ITBIS) y deja el pago en{" "}
            <strong>«Aún no»</strong>.
          </li>
          <li>
            Después, en el gasto, usa <strong>Registrar pago</strong> solo por lo que le adelantas: queda en{" "}
            <em>Pago parcial</em>.
          </li>
          <li>Cuando le pagues el resto, registra otro pago y queda <em>Pagado</em>.</li>
        </ol>
        <p className="mt-1.5 text-xs text-brand-muted">
          Ejemplo: sonido por RD$100,000 + ITBIS, adelanto RD$40,000 → gasto de RD$118,000, pago de RD$40,000, faltan
          RD$78,000. Su factura (NCF) la adjuntas cuando llegue.
        </p>
      </DismissibleTip>
      <NewExpenseForm
        categories={categories}
        suppliers={suppliers}
        projects={projects}
        accounts={accounts}
        bankCatalog={bankCatalog}
        baseCurrency={company.base_currency}
        currencies={currencyOptions.map((c) => c.code)}
        fxContext={fxContext}
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
