import { listActiveClients, listProjectsForSelect } from "@/features/invoices/queries";
import { getCompany } from "@/features/settings/queries";
import { listPaymentTerms } from "@/features/payment-terms/queries";
import { listTaxRates } from "@/features/tax-rates/queries";
import { NewInvoiceForm } from "./new-invoice-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { safeReturnTo, returnToLabel } from "@/lib/utils/return-to";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; project_id?: string; return_to?: string }>;
}) {
  const { client, project_id, return_to } = await searchParams;
  // Desde un proyecto: el proyecto viene elegido y "volver" regresa a él.
  const returnTo = safeReturnTo(return_to);
  const [clients, projects, company, paymentTerms, taxRates] = await Promise.all([
    listActiveClients(),
    listProjectsForSelect(),
    getCompany(),
    listPaymentTerms(),
    listTaxRates(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link
        href={returnTo ?? "/invoices"}
        className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
      >
        <ArrowLeft size={14} /> {returnTo ? returnToLabel(returnTo) : "Facturas"}
      </Link>
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
        defaultProjectId={projects.some((p) => p.id === project_id) ? project_id : undefined}
        returnTo={returnTo}
        baseCurrency={company.base_currency}
        paymentTerms={paymentTerms}
        taxRates={taxRates}
      />
    </main>
  );
}
