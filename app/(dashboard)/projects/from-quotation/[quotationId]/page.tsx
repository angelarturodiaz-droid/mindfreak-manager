import { notFound } from "next/navigation";
import {
  getQuotationForConversion,
  listQuotationItemsFor,
  listCompanyMembers,
} from "@/features/projects/queries";
import { ConvertQuotationForm } from "./convert-form";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

export default async function ConvertQuotationPage({
  params,
}: {
  params: Promise<{ quotationId: string }>;
}) {
  const { quotationId } = await params;

  let quotation;
  try {
    quotation = await getQuotationForConversion(quotationId);
  } catch {
    notFound();
  }
  if (!quotation) notFound();

  if (quotation.status !== "APPROVED") {
    return (
      <main className="p-8">
        <p className="text-sm text-brand-danger">
          Esta cotización no está aprobada — no se puede convertir en proyecto.
        </p>
      </main>
    );
  }
  if (quotation.project_id) {
    return (
      <main className="p-8">
        <p className="text-sm text-brand-danger">
          Esta cotización ya fue convertida en un proyecto.
        </p>
      </main>
    );
  }

  const [items, members] = await Promise.all([
    listQuotationItemsFor(quotationId),
    listCompanyMembers(),
  ]);

  const clientData = quotation.clients as { name: string } | { name: string }[] | null;
  const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">
          Convertir {quotation.number} en proyecto
        </h1>
        <p className="text-sm text-brand-muted">
          Cliente: {clientName} · Total:{" "}
          {formatMoney(quotation.total, quotation.currency)} ·{" "}
          {items.length} línea(s) — se copiarán automáticamente al proyecto.
        </p>
      </div>

      <ConvertQuotationForm
        quotationId={quotationId}
        members={members}
        suggestedName={`Evento — ${quotation.number}`}
      />
    </main>
  );
}
