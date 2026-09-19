import { listBankCatalog } from "@/features/bank-catalog/queries";
import { NewBankAccountForm } from "./new-bank-account-form";

export default async function NewBankAccountPage() {
  const bankCatalog = await listBankCatalog();

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Nueva cuenta bancaria</h1>
      </div>
      <NewBankAccountForm bankCatalog={bankCatalog} />
    </main>
  );
}
