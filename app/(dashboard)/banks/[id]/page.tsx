import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getBankAccount,
  listBankTransactions,
  listOtherActiveAccounts,
  hasBankTransactions,
} from "@/features/banks/queries";
import { toggleBankAccountActiveAction, toggleReconciledAction } from "@/features/banks/actions";
import { hasPermission } from "@/lib/auth/permissions";
import { ManualTransactionForm } from "./manual-transaction-form";
import { TransferForm } from "./transfer-form";
import { BankAccountEditForm } from "./bank-account-edit-form";
import { listBankCatalog } from "@/features/bank-catalog/queries";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ActionLink } from "@/components/ui/action-link";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";

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

type TransactionRow = Awaited<ReturnType<typeof listBankTransactions>>[number];

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

  const [transactions, otherAccounts, canCreate, canReconcile, hasTx, bankCatalog] = await Promise.all([
    listBankTransactions(id),
    listOtherActiveAccounts(id),
    hasPermission("banks.create"),
    hasPermission("banks.reconcile"),
    hasBankTransactions(id),
    listBankCatalog(),
  ]);

  const columns: Column<TransactionRow>[] = [
    { header: "Fecha", accessor: (t) => t.transaction_date },
    { header: "Tipo", accessor: (t) => <span className="text-brand-muted">{TYPE_LABELS[t.type] ?? t.type}</span> },
    { header: "Descripción", accessor: (t) => t.description ?? "—" },
    {
      header: "Monto",
      accessor: (t) => (
        <span className={t.amount < 0 ? "font-medium text-brand-danger" : "font-medium"}>
          {formatMoney(t.amount, account.currency)}
        </span>
      ),
    },
    {
      header: "Conciliado",
      accessor: (t) =>
        canReconcile ? (
          <ActionLink
            label={t.reconciled ? "Sí" : "No"}
            className={t.reconciled ? "text-sm text-brand-success hover:underline" : "text-sm text-brand-muted hover:underline"}
            onAction={toggleReconciledAction.bind(null, t.id, account.id, t.reconciled)}
          />
        ) : (
          <span>{t.reconciled ? "Sí" : "No"}</span>
        ),
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <Link
          href="/banks"
          className="inline-flex items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
        >
          <ArrowLeft size={14} /> Bancos
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
            {account.type === "CREDIT_CARD" ? (
              <>
                <p className="text-xs text-brand-muted">Deuda actual</p>
                <p className="text-lg font-semibold text-brand-danger">
                  {formatMoney(Math.max(0, -account.current_balance), account.currency)}
                </p>
                {account.credit_limit != null && (
                  <p className="text-xs text-brand-muted">
                    Límite disponible:{" "}
                    {formatMoney(
                      account.credit_limit - Math.max(0, -account.current_balance),
                      account.currency,
                    )}{" "}
                    de {formatMoney(account.credit_limit, account.currency)}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-xs text-brand-muted">Balance actual</p>
                <p className="text-lg font-semibold text-brand-primary">
                  {formatMoney(account.current_balance, account.currency)}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {canCreate && (
        <ConfirmButton
          label={account.is_active ? "Desactivar cuenta" : "Activar cuenta"}
          confirmTitle={`¿${account.is_active ? "Desactivar" : "Activar"} "${account.name}"?`}
          onConfirm={toggleBankAccountActiveAction.bind(null, account.id, account.is_active)}
        />
      )}

      {canCreate && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-brand-text">
            Editar {account.type === "CREDIT_CARD" ? "tarjeta" : "cuenta"}
          </h2>
          <Card>
            <BankAccountEditForm account={account} canEditOpeningBalance={!hasTx} bankCatalog={bankCatalog} />
          </Card>
        </section>
      )}

      {canCreate && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="mb-3 text-sm font-medium text-brand-text">Movimiento manual</h2>
            <ManualTransactionForm bankAccountId={account.id} />
          </div>
          <div>
            <h2 className="mb-3 text-sm font-medium text-brand-text">
              Transferir a otra cuenta{account.type === "BANK" ? " o pagar una tarjeta" : ""}
            </h2>
            <TransferForm fromAccountId={account.id} otherAccounts={otherAccounts} />
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-brand-text">Movimientos</h2>
        <DataTable columns={columns} rows={transactions} keyFor={(t) => t.id} maxWidth="max-w-3xl" emptyMessage="Sin movimientos todavía." />
      </div>
    </main>
  );
}
