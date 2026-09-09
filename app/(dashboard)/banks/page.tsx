import Link from "next/link";
import { listBankAccountsWithBalance } from "@/features/banks/queries";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

export default async function BanksPage() {
  const accounts = await listBankAccountsWithBalance();

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Bancos</h1>
          <p className="text-sm text-brand-muted">
            Cuentas bancarias de la empresa y sus movimientos.
          </p>
        </div>
        <Link
          href="/banks/new"
          className="bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Nueva cuenta
        </Link>
      </div>

      {accounts.length === 0 ? (
        <div className="border border-dashed border-brand-muted/30 p-8 text-center">
          <p className="text-sm text-brand-muted">
            Aún no tienes cuentas bancarias registradas.
          </p>
          <Link
            href="/banks/new"
            className="mt-2 inline-block text-sm text-brand-accent hover:underline"
          >
            Crear la primera
          </Link>
        </div>
      ) : (
        <table className="w-full max-w-2xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
              <th className="py-2 font-medium">Cuenta</th>
              <th className="py-2 font-medium">Banco</th>
              <th className="py-2 font-medium">Balance actual</th>
              <th className="py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-brand-muted/10">
                <td className="py-3">
                  <Link
                    href={`/banks/${a.id}`}
                    className="font-medium text-brand-text hover:text-brand-accent"
                  >
                    {a.name}
                  </Link>
                </td>
                <td className="py-3 text-brand-muted">{a.bank_name ?? "—"}</td>
                <td className="py-3 font-medium">
                  {formatMoney(a.current_balance, a.currency)}
                </td>
                <td className="py-3 text-brand-muted">
                  {a.is_active ? "Activa" : "Inactiva"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
