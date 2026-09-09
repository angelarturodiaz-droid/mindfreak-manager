import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBankAccount,
  listBankTransactions,
  listOtherActiveAccounts,
} from "@/features/banks/queries";
import { toggleBankAccountActiveAction, toggleReconciledAction } from "@/features/banks/actions";
import { hasPermission } from "@/lib/auth/permissions";
import { ManualTransactionForm } from "./manual-transaction-form";
import { TransferForm } from "./transfer-form";

const TYPE_LABELS: Record<string, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
  TRANSFER: "Transferencia",
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

export default async function BankAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let account;
  try {
    account = await getBankAccount(id);
  } catch {
    notFound();
  }
  if (!account) notFound();

  const [transactions, otherAccounts, canCreate, canReconcile] = await Promise.all([
    listBankTransactions(id),
    listOtherActiveAccounts(id),
    hasPermission("banks.create"),
    hasPermission("banks.reconcile"),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/banks" className="text-sm text-brand-muted hover:text-brand-text">
          ← Bancos
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-brand-primary">{account.name}</h1>
            <p className="text-sm text-brand-muted">
              {account.bank_name ?? "—"}
              {account.account_number_masked && ` · ${account.account_number_masked}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-brand-muted">Balance actual</p>
            <p className="text-lg font-semibold text-brand-primary">
              {formatMoney(account.current_balance, account.currency)}
            </p>
          </div>
        </div>
      </div>

      {canCreate && (
        <form action={toggleBankAccountActiveAction.bind(null, account.id, account.is_active)}>
          <button
            type="submit"
            className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-muted hover:border-brand-danger hover:text-brand-danger"
          >
            {account.is_active ? "Desactivar cuenta" : "Activar cuenta"}
          </button>
        </form>
      )}

      {canCreate && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="mb-3 text-sm font-medium text-brand-text">Movimiento manual</h2>
            <ManualTransactionForm bankAccountId={account.id} />
          </div>
          <div>
            <h2 className="mb-3 text-sm font-medium text-brand-text">
              Transferir a otra cuenta
            </h2>
            <TransferForm fromAccountId={account.id} otherAccounts={otherAccounts} />
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-brand-text">Movimientos</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-brand-muted">Sin movimientos todavía.</p>
        ) : (
          <table className="w-full max-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                <th className="py-2 font-medium">Fecha</th>
                <th className="py-2 font-medium">Tipo</th>
                <th className="py-2 font-medium">Descripción</th>
                <th className="py-2 font-medium">Monto</th>
                <th className="py-2 font-medium">Conciliado</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-brand-muted/10">
                  <td className="py-2">{t.transaction_date}</td>
                  <td className="py-2 text-brand-muted">
                    {TYPE_LABELS[t.type] ?? t.type}
                  </td>
                  <td className="py-2">{t.description ?? "—"}</td>
                  <td
                    className={
                      t.amount < 0 ? "py-2 font-medium text-brand-danger" : "py-2 font-medium"
                    }
                  >
                    {formatMoney(t.amount, account.currency)}
                  </td>
                  <td className="py-2">
                    {canReconcile ? (
                      <form
                        action={toggleReconciledAction.bind(
                          null,
                          t.id,
                          account.id,
                          t.reconciled,
                        )}
                      >
                        <button
                          type="submit"
                          className={
                            t.reconciled
                              ? "text-brand-success hover:underline"
                              : "text-brand-muted hover:underline"
                          }
                        >
                          {t.reconciled ? "Sí" : "No"}
                        </button>
                      </form>
                    ) : t.reconciled ? (
                      "Sí"
                    ) : (
                      "No"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
