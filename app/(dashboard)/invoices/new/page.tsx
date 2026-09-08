import { listActiveClients, listProjectsForSelect } from "@/features/invoices/queries";
import { NewInvoiceForm } from "./new-invoice-form";

export default async function NewInvoicePage() {
  const [clients, projects] = await Promise.all([
    listActiveClients(),
    listProjectsForSelect(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">
          Nueva factura
        </h1>
        <p className="text-sm text-brand-muted">
          Si eliges un proyecto, el cliente se toma automáticamente de ahí.
        </p>
      </div>
      <NewInvoiceForm clients={clients} projects={projects} />
    </main>
  );
}
