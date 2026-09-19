import { listBankCatalog } from "@/features/bank-catalog/queries";
import { NewSupplierForm } from "./new-supplier-form";

export default async function NewSupplierPage() {
  const bankCatalog = await listBankCatalog();

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Nuevo proveedor</h1>
      </div>

      <NewSupplierForm bankCatalog={bankCatalog} />
    </main>
  );
}
