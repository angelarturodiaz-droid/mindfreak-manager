import Link from "next/link";
import { Landmark, Plus } from "lucide-react";
import { listBankAccountsWithBalance } from "@/features/banks/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

type AccountRow = Awaited<ReturnType<typeof listBankAccountsWithBalance>>[number];

export default async function BanksPage() {
  const accounts = await listBankAccountsWithBalance();

  const columns: Column<AccountRow>[] = [
    {
      header: "Cuenta",
      accessor: (a) => (
        <Link href={`/banks/${a.id}`} className="font-medium text-brand-text hover:text-brand-accent">
          {a.name}
        </Link>
      ),
    },
    { header: "Banco", accessor: (a) => <span className="text-brand-muted">{a.bank_name ?? "—"}</span> },
    { header: "Balance actual", accessor: (a) => <span className="font-medium">{formatMoney(a.current_balance, a.currency)}</span> },
    {
      header: "Estado",
      accessor: (a) => <Badge tone={a.is_active ? "success" : "danger"}>{a.is_active ? "Activa" : "Inactiva"}</Badge>,
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Bancos</h1>
          <p className="text-sm text-brand-muted">
            Cuentas bancarias de la empresa y sus movimientos.
          </p>
        </div>
        <Link href="/banks/new">
          <Button size="sm" icon={<Plus size={14} />}>
            Nueva cuenta
          </Button>
        </Link>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Landmark size={28} />}
          title="Aún no tienes cuentas bancarias registradas."
          action={
            <Link href="/banks/new">
              <Button size="sm" icon={<Plus size={14} />}>
                Crear la primera
              </Button>
            </Link>
          }
        />
      ) : (
        <DataTable columns={columns} rows={accounts} keyFor={(a) => a.id} maxWidth="max-w-2xl" />
      )}
    </main>
  );
}
