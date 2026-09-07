import Link from "next/link";
import { notFound } from "next/navigation";
import { getService, listServiceCategories } from "@/features/services/queries";
import { deactivateServiceAction } from "@/features/services/actions";
import { ServiceEditForm } from "./service-edit-form";

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
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <Link href="/services" className="text-sm text-brand-muted hover:text-brand-text">
          ← Servicios
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-brand-primary">
            {service.name}
          </h1>
          {!service.is_active && (
            <span className="text-sm text-brand-danger">(inactivo)</span>
          )}
        </div>
      </div>

      {service.is_active && (
        <form action={deactivateServiceAction.bind(null, service.id)}>
          <button
            type="submit"
            className="w-fit border border-brand-muted/30 px-4 py-2 text-sm text-brand-muted hover:border-brand-danger hover:text-brand-danger"
          >
            Desactivar servicio
          </button>
        </form>
      )}

      <section className="max-w-md">
        <ServiceEditForm service={service} categories={categories} />
      </section>
    </main>
  );
}
