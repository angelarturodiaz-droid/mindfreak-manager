import { listActiveClients } from "@/features/quotations/queries";
import { getCompany } from "@/features/settings/queries";
import { getFxContext, listCurrencyOptions } from "@/features/currencies/queries";
import { listPaymentTerms } from "@/features/payment-terms/queries";
import { listTaxRates } from "@/features/tax-rates/queries";
import { NewQuotationForm } from "./new-quotation-form";
import { getProjectBasic } from "@/features/projects/queries";

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; project?: string }>;
}) {
  const { client, project: projectParam } = await searchParams;
  // Cotización adicional desde la pestaña Servicios de un proyecto.
  const project = projectParam ? await getProjectBasic(projectParam).catch(() => null) : null;
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
          {project ? `Cotización adicional · ${project.number}` : "Nueva cotización"}
        </h1>
        <p className="text-sm text-brand-muted">
          Puedes cotizar a un cliente activo o a un lead — no hace falta que
          ya sea cliente confirmado.
        </p>
      </div>
      {project && (
        <div className="max-w-md rounded-[var(--radius-md)] border border-brand-accent/30 bg-brand-accent-light px-4 py-3 text-sm text-brand-text">
          Es para lo que el cliente pidió <strong>de más</strong> en el proyecto <strong>{project.number} · {project.name}</strong>.
          Cuando el cliente la apruebe, sus líneas se suman solas a la pestaña <em>Servicios</em> del proyecto.
        </div>
      )}
      <NewQuotationForm
        projectId={project?.id}
        lockClient={Boolean(project)}
        clients={clients}
        defaultClientId={project ? project.client_id : clients.some((c) => c.id === client) ? client : undefined} baseCurrency={company.base_currency} currencies={currencyOptions.map((c) => c.code)} rates={fxContext.rates} paymentTerms={paymentTerms} taxRates={taxRates} />
    </main>
  );
}
