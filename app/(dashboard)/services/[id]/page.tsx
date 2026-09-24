import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, Wrench } from "lucide-react";
import { getService, listServiceCategories } from "@/features/services/queries";
import { deactivateServiceAction } from "@/features/services/actions";
import { listTaxRates } from "@/features/tax-rates/queries";
import { ServiceEditForm } from "./service-edit-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { IconBadge } from "@/components/ui/icon-badge";
import { MetricCard, SectionHeader } from "@/components/ui/page-kit";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(amount);
}

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

  const [categories, taxRates] = await Promise.all([listServiceCategories(), listTaxRates()]);

  const category = categories.find((c) => c.id === service.category_id);
  const taxRate = taxRates.find((t) => t.id === service.default_tax_rate_id);
  const margin =
    service.default_price > 0
      ? ((service.default_price - service.default_cost) / service.default_price) * 100
      : null;

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link
        href="/services"
        className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
      >
        <ArrowLeft size={14} /> Productos y Servicios
      </Link>

      <Card className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <IconBadge
            icon={service.type === "PRODUCTO" ? <Package size={22} /> : <Wrench size={22} />}
            tone={service.type === "PRODUCTO" ? "blue" : "green"}
            size="lg"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-brand-primary">{service.name}</h1>
              <Badge tone={service.type === "PRODUCTO" ? "info" : "success"}>
                {service.type === "PRODUCTO" ? "Producto" : "Servicio"}
              </Badge>
              {!service.is_active && <Badge tone="danger">Inactivo</Badge>}
            </div>
            <p className="mt-1 text-sm text-brand-muted">
              {category?.name ?? "Sin categoría"}
              {service.unit ? ` · por ${service.unit}` : ""}
            </p>
            {service.description && <p className="mt-2 max-w-2xl text-sm text-brand-text">{service.description}</p>}
          </div>
        </div>
        {service.is_active && (
          <ConfirmButton
            label="Desactivar"
            confirmTitle={`¿Desactivar "${service.name}"?`}
            onConfirm={deactivateServiceAction.bind(null, service.id)}
          />
        )}
      </Card>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Precio por defecto" value={formatMoney(service.default_price)} />
        <MetricCard label="Costo por defecto" value={formatMoney(service.default_cost)} />
        <MetricCard
          label="Margen"
          value={margin === null ? "—" : `${margin.toFixed(1)}%`}
          tone={margin !== null && margin < 0 ? "danger" : margin !== null && margin < 20 ? "warning" : "success"}
          hint={margin === null ? "Sin precio definido" : `Ganancia ${formatMoney(service.default_price - service.default_cost)} por unidad`}
        />
        <MetricCard
          label="Impuesto por defecto"
          value={taxRate ? `${taxRate.rate}%` : "—"}
          hint={taxRate ? taxRate.name : "Usa el predeterminado del catálogo"}
        />
      </section>

      <section className="max-w-2xl">
        <SectionHeader title="Editar" description="Estos valores se precargan al agregar la línea en una cotización o factura." />
        <Card>
          <ServiceEditForm service={service} categories={categories} taxRates={taxRates} />
        </Card>
      </section>
    </main>
  );
}
