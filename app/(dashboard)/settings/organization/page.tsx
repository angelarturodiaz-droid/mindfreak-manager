import { getCompany } from "@/features/settings/queries";
import { OrganizationForm } from "./organization-form";
import { hasFinancialActivity, listCurrencies } from "@/features/currencies/queries";

export default async function OrganizationSettingsPage() {
  const [company, currencies, locked] = await Promise.all([getCompany(), listCurrencies(true), hasFinancialActivity()]);

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">
        Datos de la empresa
      </h2>
      <OrganizationForm
        company={company}
        currencies={currencies.map((c) => ({ code: c.code, name: c.name }))}
        currencyLocked={locked}
      />
    </div>
  );
}
