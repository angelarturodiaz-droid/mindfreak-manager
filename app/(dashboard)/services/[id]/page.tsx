import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getService, listServiceCategories } from "@/features/services/queries";
import { deactivateServiceAction } from "@/features/services/actions";
import { ServiceEditForm } from "./service-edit-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let service;
  try {
    service = await getService(id);
  } catch {
    notFound();
  }
  if (!service) notFound();

  const categories = await listServiceCategories();

  return (
    <main className="flex flex-1 flex-col gap-8 p-4 md:p-8">
      <div>
        <Link
          href="/services"
          className="inline-flex items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
        >
          <ArrowLeft size={14} /> Productos y Servicios
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-brand-primary">
            {service.name}
          </h1>
          {!service.is_active && <Badge tone="danger">Inactivo</Badge>}
        </div>
      </div>

      {service.is_active && (
        <ConfirmButton
          label="Desactivar"
          confirmTitle={`¿Desactivar "${service.name}"?`}
          onConfirm={deactivateServiceAction.bind(null, service.id)}
        />
      )}

      <section className="max-w-md">
        <Card>
          <ServiceEditForm service={service} categories={categories} />
        </Card>
      </section>
    </main>
  );
}
