import { listActiveClients } from "@/features/quotations/queries";
import { getCompany } from "@/features/settings/queries";
import { NewQuotationForm } from "./new-quotation-form";

export default async function NewQuotationPage() {
  const [clients, company] = await Promise.all([listActiveClients(), getCompany()]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">
          Nueva cotización
        </h1>
        <p className="text-sm text-brand-muted">
          Puedes cotizar a un cliente activo o a un lead — no hace falta que
          ya sea cliente confirmado.
        </p>
      </div>
      <NewQuotationForm clients={clients} baseCurrency={company.base_currency} />
    </main>
  );
}
