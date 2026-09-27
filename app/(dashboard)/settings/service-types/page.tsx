import Link from "next/link";
import { listServiceTypesWithUsage } from "@/features/supplier-service-types/queries";
import { listCategoryOptions } from "@/features/expense-categories/queries";
import { NewServiceTypeForm } from "./new-service-type-form";
import { ImportServiceTypesForm } from "./import-service-types-form";
import { DeleteServiceTypeButton } from "./delete-service-type-button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";

type Row = Awaited<ReturnType<typeof listServiceTypesWithUsage>>[number];

export default async function ServiceTypesSettingsPage() {
  const [types, categories] = await Promise.all([listServiceTypesWithUsage(), listCategoryOptions()]);

  const columns: Column<Row>[] = [
    { header: "Categoría", accessor: (t) => <span className="text-brand-muted">{t.categoryName}</span> },
    { header: "Tipo de servicio", accessor: (t) => <span className="font-medium text-brand-text">{t.name}</span> },
    {
      header: "Proveedores",
      className: "text-right",
      accessor: (t) => <span className="tabular-nums text-brand-muted">{t.supplierCount}</span>,
    },
    {
      header: "",
      className: "text-right",
      accessor: (t) => (
        <DeleteServiceTypeButton serviceTypeId={t.id} name={t.name} supplierCount={t.supplierCount} />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-brand-primary">Tipos de servicio de proveedores</h2>
        <p className="max-w-3xl text-sm text-brand-muted">
          Qué hace cada proveedor, dentro de su categoría. Ej. Audiovisuales → Alquiler de sonido,
          Alquiler de pantallas. Las categorías salen de{" "}
          <Link href="/settings/expense-categories" className="text-brand-accent hover:underline">
            Categorías
          </Link>
          . Al crear o editar un proveedor eliges primero la categoría y luego su tipo de servicio.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <p className="mb-3 text-sm font-semibold text-brand-text">Nuevo tipo de servicio</p>
          <NewServiceTypeForm categories={categories} />
        </Card>
        <Card>
          <p className="mb-3 text-sm font-semibold text-brand-text">Importar varios desde CSV</p>
          <ImportServiceTypesForm />
        </Card>
      </div>

      <DataTable
        columns={columns}
        rows={types}
        keyFor={(t) => t.id}
        maxWidth="max-w-4xl"
        emptyMessage="Sin tipos de servicio todavía."
      />
    </div>
  );
}
