import Link from "next/link";
import { Landmark, CreditCard, Plus } from "lucide-react";
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
  const banks = accounts.filter((a) => a.type !== "CREDIT_CARD");
  const cards = accounts.filter((a) => a.type === "CREDIT_CARD");

  const bankColumns: Column<AccountRow>[] = [
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

  const cardColumns: Column<AccountRow>[] = [
    {
      header: "Tarjeta",
      accessor: (a) => (
        <Link href={`/banks/${a.id}`} className="font-medium text-brand-text hover:text-brand-accent">
          {a.name}
        </Link>
      ),
    },
    { header: "Banco", accessor: (a) => <span className="text-brand-muted">{a.bank_name ?? "—"}</span> },
    {
      header: "Deuda actual",
      accessor: (a) => {
        const debt = Math.max(0, -a.current_balance);
        return <span className={debt > 0 ? "font-medium text-brand-danger" : "font-medium"}>{formatMoney(debt, a.currency)}</span>;
      },
    },
    {
      header: "Límite",
      accessor: (a) => <span className="text-brand-muted">{a.credit_limit != null ? formatMoney(a.credit_limit, a.currency) : "—"}</span>,
    },
    {
      header: "Estado",
      accessor: (a) => <Badge tone={a.is_active ? "success" : "danger"}>{a.is_active ? "Activa" : "Inactiva"}</Badge>,
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-8 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Bancos</h1>
          <p className="text-sm text-brand-muted">
            Consolidado de los movimientos generados por facturas, cobros,
            gastos y pagos. Los movimientos manuales siguen disponibles para
            lo que no venga de ahí.
          </p>
        </div>
        <Link href="/banks/new">
          <Button size="sm" icon={<Plus size={14} />}>
            Nueva cuenta o tarjeta
          </Button>
        </Link>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Landmark size={28} />}
          title="Aún no tienes cuentas bancarias ni tarjetas registradas."
          action={
            <Link href="/banks/new">
              <Button size="sm" icon={<Plus size={14} />}>
                Crear la primera
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-sm font-medium text-brand-text">Cuentas bancarias</h2>
            {banks.length === 0 ? (
              <p className="text-sm text-brand-muted">Sin cuentas bancarias todavía.</p>
            ) : (
              <DataTable columns={bankColumns} rows={banks} keyFor={(a) => a.id} maxWidth="max-w-2xl" />
            )}
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-brand-text">
              <CreditCard size={16} /> Tarjetas de crédito
            </h2>
            {cards.length === 0 ? (
              <p className="text-sm text-brand-muted">Sin tarjetas registradas todavía.</p>
            ) : (
              <DataTable columns={cardColumns} rows={cards} keyFor={(a) => a.id} maxWidth="max-w-3xl" />
            )}
          </section>
        </>
      )}
    </main>
  );
}
