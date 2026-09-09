import { NewBankAccountForm } from "./new-bank-account-form";

export default function NewBankAccountPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Nueva cuenta bancaria</h1>
      </div>
      <NewBankAccountForm />
    </main>
  );
}
