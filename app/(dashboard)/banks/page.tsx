import Link from "next/link";
import { AlertTriangle, ChevronRight, CreditCard, Landmark, Plus, ShieldCheck, Wallet } from "lucide-react";
import { listBankAccountsWithBalance } from "@/features/banks/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBadge } from "@/components/ui/icon-badge";
import { ProgressBar, SectionHeader, StatCard, StatGrid } from "@/components/ui/page-kit";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

type AccountRow = Awaited<ReturnType<typeof listBankAccountsWithBalance>>[number];

/** Suma por moneda: { DOP: 1000, USD: 50 } */
function sumByCurrency(rows: AccountRow[], value: (a: AccountRow) => number) {
  const out: Record<string, number> = {};
  for (const a of rows) out[a.currency] = (out[a.currency] ?? 0) + value(a);
  return out;
}

/** Monto principal (moneda base primero) y el resto como texto secundario. */
function splitCurrencies(totals: Record<string, number>, base = "DOP") {
  const main = totals[base] ?? 0;
  const others = Object.entries(totals)
    .filter(([c, v]) => c !== base && v !== 0)
    .map(([c, v]) => formatMoney(v, c));
  return { main: formatMoney(main, base), others };
}

function AccountCard({ a }: { a: AccountRow }) {
  const isCard = a.type === "CREDIT_CARD";
  const debt = Math.max(0, -a.current_balance);
  const usage = isCard && a.credit_limit ? (debt / a.credit_limit) * 100 : null;
  return (
    <Link
      href={`/banks/${a.id}`}
      className={`group flex flex-col gap-4 rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-5 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)] ${
        a.is_active ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconBadge icon={isCard ? <CreditCard size={18} /> : <Landmark size={18} />} tone={isCard ? "violet" : "blue"} />
          <div className="min-w-0">
            <p className="truncate font-medium text-brand-text group-hover:text-brand-accent">{a.name}</p>
            <p className="truncate text-xs text-brand-muted">
              {a.bank_name ?? "Sin banco"}
              {a.account_number_masked ? ` · ${a.account_number_masked}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!a.is_active && <Badge tone="neutral">Inactiva</Badge>}
          <Badge tone="neutral">{a.currency}</Badge>
          <ChevronRight size={16} className="text-brand-muted group-hover:text-brand-accent" />
        </div>
      </div>

      {a.uncategorized_count > 0 && (
        <p className="-mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-warning-bg px-2.5 py-0.5 text-xs font-medium text-brand-warning">
          <AlertTriangle size={12} />
          {a.uncategorized_count === 1 ? "1 sin categoría" : `${a.uncategorized_count} sin categoría`}
        </p>
      )}

      {isCard ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-xs text-brand-muted">Deuda actual</p>
              <p className={`text-xl font-semibold tabular-nums ${debt > 0 ? "text-brand-danger" : "text-brand-text"}`}>
                {formatMoney(debt, a.currency)}
              </p>
            </div>
            {a.credit_limit != null && (
              <div className="text-right">
                <p className="text-xs text-brand-muted">Disponible</p>
                <p className="text-sm font-medium tabular-nums text-brand-text">
                  {formatMoney(a.credit_limit - debt, a.currency)}
                </p>
              </div>
            )}
          </div>
          {usage !== null && (
            <>
              <ProgressBar pct={usage} danger={usage >= 80} />
              <p className="text-xs text-brand-muted">
                {usage.toFixed(0)}% usado de {formatMoney(a.credit_limit ?? 0, a.currency)}
              </p>
            </>
          )}
        </div>
      ) : (
        <div>
          <p className="text-xs text-brand-muted">Balance actual</p>
          <p
            className={`text-2xl font-semibold tracking-tight tabular-nums ${
              a.current_balance < 0 ? "text-brand-danger" : "text-brand-text"
            }`}
          >
            {formatMoney(a.current_balance, a.currency)}
          </p>
        </div>
      )}
    </Link>
  );
}

export default async function BanksPage() {
  const accounts = await listBankAccountsWithBalance();
  const banks = accounts.filter((a) => a.type !== "CREDIT_CARD");
  const cards = accounts.filter((a) => a.type === "CREDIT_CARD");
  const activeBanks = banks.filter((a) => a.is_active);
  const activeCards = cards.filter((a) => a.is_active);

  const available = splitCurrencies(sumByCurrency(activeBanks, (a) => a.current_balance));
  const debt = splitCurrencies(sumByCurrency(activeCards, (a) => Math.max(0, -a.current_balance)));
  const creditLeft = splitCurrencies(
    sumByCurrency(
      activeCards.filter((a) => a.credit_limit != null),
      (a) => (a.credit_limit ?? 0) - Math.max(0, -a.current_balance),
    ),
  );
  const debtTotal = activeCards.reduce((acc, a) => acc + Math.max(0, -a.current_balance), 0);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Bancos</h1>
          <p className="max-w-2xl text-sm text-brand-muted">
            Tus cuentas y tarjetas. Los movimientos se generan solos desde facturas, cobros,
            gastos y pagos; los manuales quedan para lo que no venga de ahí.
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
          {(() => {
            const pending = accounts.reduce((acc, a) => acc + a.uncategorized_count, 0);
            if (pending === 0) return null;
            const first = accounts.find((a) => a.uncategorized_count > 0);
            return (
              <Link
                href={first ? `/banks/${first.id}?cat=none` : "/banks"}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-brand-warning/30 bg-brand-warning-bg px-4 py-3 text-sm text-brand-text hover:border-brand-warning/60"
              >
                <span className="inline-flex items-center gap-2 font-medium">
                  <AlertTriangle size={16} className="text-brand-warning" />
                  {pending === 1 ? "1 movimiento sin categoría" : `${pending} movimientos sin categoría`}
                </span>
                <span className="text-brand-muted">Clasifícalos para que salgan bien en los reportes →</span>
              </Link>
            );
          })()}

          <StatGrid>
            <StatCard
              label="Disponible en bancos"
              value={available.main}
              hint={available.others.length ? `+ ${available.others.join(" · ")}` : `${activeBanks.length} cuentas activas`}
              icon={<Wallet size={20} />}
              tone="green"
            />
            <StatCard
              label="Deuda en tarjetas"
              value={debt.main}
              valueTone={debtTotal > 0 ? "danger" : undefined}
              hint={debt.others.length ? `+ ${debt.others.join(" · ")}` : `${activeCards.length} tarjetas activas`}
              icon={<CreditCard size={20} />}
              tone="red"
            />
            <StatCard
              label="Crédito disponible"
              value={creditLeft.main}
              hint={creditLeft.others.length ? `+ ${creditLeft.others.join(" · ")}` : "Límite menos deuda"}
              icon={<ShieldCheck size={20} />}
              tone="violet"
            />
            <StatCard
              label="Cuentas y tarjetas"
              value={String(activeBanks.length + activeCards.length)}
              hint={`${accounts.length - activeBanks.length - activeCards.length} inactivas`}
              icon={<Landmark size={20} />}
              tone="blue"
            />
          </StatGrid>

          <section>
            <SectionHeader title="Cuentas bancarias" count={banks.length} />
            {banks.length === 0 ? (
              <p className="rounded-[var(--radius-lg)] border border-dashed border-brand-border p-6 text-center text-sm text-brand-muted">
                Sin cuentas bancarias todavía.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {banks.map((a) => (
                  <AccountCard key={a.id} a={a} />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader title="Tarjetas de crédito" count={cards.length} />
            {cards.length === 0 ? (
              <p className="rounded-[var(--radius-lg)] border border-dashed border-brand-border p-6 text-center text-sm text-brand-muted">
                Sin tarjetas registradas todavía.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {cards.map((a) => (
                  <AccountCard key={a.id} a={a} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
