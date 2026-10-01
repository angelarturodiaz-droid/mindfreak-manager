import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listDeliveryFormOptions } from "@/features/deliveries/queries";
import { createDeliveryAction } from "@/features/deliveries/actions";
import { getCompany } from "@/features/settings/queries";
import { DeliveryForm } from "@/components/deliveries/delivery-form";
import { requirePermission } from "@/lib/auth/permissions";
import { returnToLabel, safeReturnTo } from "@/lib/utils/return-to";

export default async function NewDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; project_id?: string; return_to?: string }>;
}) {
  await requirePermission("deliveries.create");
  const { client, project_id, return_to } = await searchParams;
  // Desde un cliente: el cliente viene elegido y "volver" regresa a él.
  const returnTo = safeReturnTo(return_to);
  const [{ clients, projects }, company] = await Promise.all([listDeliveryFormOptions(), getCompany()]);
  const project = projects.find((p) => p.id === project_id);
  const clientId = clients.some((c) => c.id === client) ? client : project?.client_id ?? "";

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link
        href={returnTo ?? "/deliveries"}
        className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
      >
        <ArrowLeft size={14} /> {returnTo ? returnToLabel(returnTo) : "Entregas y acuses"}
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Nuevo acuse de entrega</h1>
        <p className="text-sm text-brand-muted">
          Registra lo que se le entrega al cliente. Después lo imprimes para firmar y adjuntas el acuse firmado.
        </p>
      </div>
      <DeliveryForm
        action={createDeliveryAction}
        clients={clients.filter((c) => c.is_active || c.id === clientId)}
        projects={projects}
        companyName={company.legal_name ?? company.name}
        initial={{ client_id: clientId ?? "", project_id: project?.id ?? "" }}
        returnTo={returnTo}
        submitLabel="Guardar acuse"
        cancelHref={returnTo ?? "/deliveries"}
      />
    </main>
  );
}
