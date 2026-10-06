import { listBankCatalog } from "@/features/bank-catalog/queries";
import { NewBankAccountForm } from "./new-bank-account-form";
import { getCompany } from "@/features/settings/queries";
import { listCurrencyOptions } from "@/features/currencies/queries";

export default async function NewBankAccountPage() {
  const company = await getCompany();
  const [bankCatalog, currencies] = await Promise.all([listBankCatalog(), listCurrencyOptions(company.base_currency)]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Nueva cuenta bancaria</h1>
      </div>
      <NewBankAccountForm bankCatalog={bankCatalog} currencies={currencies} defaultCurrency={company.base_currency} />
    </main>
  );
}
