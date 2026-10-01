import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDelivery, listDeliveryItems, listDeliveryFormOptions } from "@/features/deliveries/queries";
import { updateDeliveryAction } from "@/features/deliveries/actions";
import { getCompany } from "@/features/settings/queries";
import { DeliveryForm } from "@/components/deliveries/delivery-form";
import { requirePermission } from "@/lib/auth/permissions";
import { safeReturnTo, withReturnTo } from "@/lib/utils/return-to";

export default async function EditDeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ return_to?: string }>;
}) {
  await requirePermission("deliveries.create");
  const { id } = await params;
  const returnTo = safeReturnTo((await searchParams).return_to);

  let receipt;
  try {
    receipt = await getDelivery(id);
  } catch {
    notFound();
  }
  if (!receipt) notFound();
  if (!["DRAFT", "ISSUED"].includes(receipt.status)) redirect(`/deliveries/${id}`);

  const [items, { clients, projects }, company] = await Promise.all([
    listDeliveryItems(id),
    listDeliveryFormOptions(),
    getCompany(),
  ]);
  const detailHref = withReturnTo(`/deliveries/${id}`, returnTo);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link href={detailHref} className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text">
        <ArrowLeft size={14} /> {receipt.number}
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Editar acuse {receipt.number}</h1>
        <p className="text-sm text-brand-muted">
          {receipt.status === "ISSUED"
            ? "Este acuse ya estaba pendiente de firma: si ya lo imprimiste, vuelve a imprimirlo después de guardar."
            : "Los cambios se ven en el PDF la próxima vez que lo imprimas."}
        </p>
      </div>
      <DeliveryForm
        action={updateDeliveryAction.bind(null, id)}
        clients={clients.filter((c) => c.is_active || c.id === receipt.client_id)}
        projects={projects}
        companyName={company.legal_name ?? company.name}
        initial={{
          client_id: receipt.client_id,
          project_id: receipt.project_id ?? "",
          delivery_type: receipt.delivery_type,
          subtitle: receipt.subtitle ?? "",
          delivery_date: receipt.delivery_date,
          place: receipt.place ?? "",
          recipient_name: receipt.recipient_name,
          recipient_short_name: receipt.recipient_short_name ?? "",
          recipient_department: receipt.recipient_department ?? "",
          reference: receipt.reference ?? "",
          intro_text: receipt.intro_text ?? "",
          notes: receipt.notes ?? "",
          copies: receipt.copies,
          delivered_by_name: receipt.delivered_by_name ?? "",
          delivered_by_id_number: receipt.delivered_by_id_number ?? "",
          items,
        }}
        returnTo={returnTo}
        submitLabel="Guardar cambios"
        cancelHref={detailHref}
      />
    </main>
  );
}
