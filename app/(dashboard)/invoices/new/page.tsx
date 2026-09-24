import { listActiveClients, listProjectsForSelect } from "@/features/invoices/queries";
import { getCompany } from "@/features/settings/queries";
import { listPaymentTerms } from "@/features/payment-terms/queries";
import { listTaxRates } from "@/features/tax-rates/queries";
import { NewInvoiceForm } from "./new-invoice-form";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const [clients, projects, company, paymentTerms, taxRates] = await Promise.all([
    listActiveClients(),
    listProjectsForSelect(),
    getCompany(),
    listPaymentTerms(),
    listTaxRates(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">
          Nueva factura
        </h1>
        <p className="text-sm text-brand-muted">
          Si eliges un proyecto, el cliente se toma automáticamente de ahí.
        </p>
      </div>
      <NewInvoiceForm
        clients={clients}
        defaultClientId={clients.some((c) => c.id === client) ? client : undefined}
        projects={projects}
        baseCurrency={company.base_currency}
        paymentTerms={paymentTerms}
        taxRates={taxRates}
      />
    </main>
  );
}
