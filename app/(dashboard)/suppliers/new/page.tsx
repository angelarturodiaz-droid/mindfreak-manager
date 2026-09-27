import { listBankCatalog } from "@/features/bank-catalog/queries";
import { NewSupplierForm } from "./new-supplier-form";
import { listCategoryOptions } from "@/features/expense-categories/queries";
import { listServiceTypeOptions } from "@/features/supplier-service-types/queries";

export default async function NewSupplierPage() {
  const [bankCatalog, categories, serviceTypes] = await Promise.all([
    listBankCatalog(),
    listCategoryOptions(),
    listServiceTypeOptions(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Nuevo proveedor</h1>
      </div>

      <NewSupplierForm bankCatalog={bankCatalog} categories={categories} serviceTypes={serviceTypes} />
    </main>
  );
}
