import { listActiveClients } from "@/features/quotations/queries";
import { getCompany } from "@/features/settings/queries";
import { getFxContext, listCurrencyOptions } from "@/features/currencies/queries";
import { listPaymentTerms } from "@/features/payment-terms/queries";
import { listTaxRates } from "@/features/tax-rates/queries";
import { NewQuotationForm } from "./new-quotation-form";

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const [clients, company, paymentTerms, taxRates, currencyOptions, fxContext] = await Promise.all([
    listActiveClients(),
    getCompany(),
    listPaymentTerms(),
    listTaxRates(),
    listCurrencyOptions(),
    getFxContext(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">
          Nueva cotización
        </h1>
        <p className="text-sm text-brand-muted">
          Puedes cotizar a un cliente activo o a un lead — no hace falta que
          ya sea cliente confirmado.
        </p>
      </div>
      <NewQuotationForm clients={clients} defaultClientId={clients.some((c) => c.id === client) ? client : undefined} baseCurrency={company.base_currency} currencies={currencyOptions.map((c) => c.code)} rates={fxContext.rates} paymentTerms={paymentTerms} taxRates={taxRates} />
    </main>
  );
}
