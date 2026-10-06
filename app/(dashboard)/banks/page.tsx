import Link from "next/link";
import { AlertTriangle, ChevronRight, CreditCard, DollarSign, LayoutGrid, Landmark, List, Plus, ShieldCheck, Wallet } from "lucide-react";
import { listBankAccountsWithBalance } from "@/features/banks/queries";
import { availableCash, cardPosition, type CashSummary } from "@/features/banks/display";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type Column } from "@/components/ui/data-table";
import { NoResults } from "@/components/ui/no-results";
import { IconBadge } from "@/components/ui/icon-badge";
import {
  FilterPills,
  ProgressBar,
  SectionHeader,
  StatCard,
  StatGrid,
  listHref,
} from "@/components/ui/page-kit";
import { ACCOUNT_KIND_LABELS } from "@/features/banks/schema";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

type AccountRow = Awaited<ReturnType<typeof listBankAccountsWithBalance>>[number];

/** "Ahorros RD$X · Corriente RD$Y · 3 cuentas" para la tarjeta de disponible. */
function cashHint(c: CashSummary, currency: string) {
  if (c.count === 0) return `Sin cuentas en ${currency === "USD" ? "dólares" : "pesos"}`;
  const parts: string[] = [];
  if (c.savings !== 0) parts.push(`Ahorros ${formatMoney(c.savings, currency)}`);
  if (c.checking !== 0) parts.push(`Corriente ${formatMoney(c.checking, currency)}`);
  if (c.other !== 0) parts.push(`Sin tipo ${formatMoney(c.other, currency)}`);
  parts.push(c.count === 1 ? "1 cuenta" : `${c.count} cuentas`);
  return parts.join(" · ");
}

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
  const { debt, favor, available, usage } = cardPosition(a.current_balance, a.credit_limit, a.favor_increases_limit);
  return (
    <Link
      href={`/banks/${a.id}`}
      className={`group flex min-w-0 flex-col gap-3 rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-4 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)] ${
        a.is_active ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconBadge icon={isCard ? <CreditCard size={18} /> : <Landmark size={18} />} tone={isCard ? "violet" : "blue"} />
          <div className="min-w-0">
            <p className="truncate font-medium text-brand-text group-hover:text-brand-accent">{a.name}</p>
            <p className="truncate text-xs text-brand-muted">
              {!isCard && a.account_kind ? `${ACCOUNT_KIND_LABELS[a.account_kind] ?? ""} · ` : ""}
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
              <p className={`whitespace-nowrap text-xl font-semibold tabular-nums ${debt > 0 ? "text-brand-danger" : "text-brand-text"}`}>
                {formatMoney(debt, a.currency)}
              </p>
            </div>
            {available != null && (
              <div className="text-right">
                <p className="text-xs text-brand-muted">Disponible</p>
                <p className="text-sm font-medium tabular-nums text-brand-text">
                  {formatMoney(available, a.currency)}
                </p>
              </div>
            )}
          </div>
          {favor > 0 && (
            <p className="inline-flex w-fit items-center rounded-full bg-brand-success-bg px-2.5 py-0.5 text-xs font-medium text-brand-success">
              Saldo a favor: {formatMoney(favor, a.currency)}
            </p>
          )}
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
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-brand-muted">
            Balance actual
            {a.current_balance < 0 && (
              <span className="rounded-full bg-brand-danger-bg px-2 py-0.5 font-medium text-brand-danger">En sobregiro</span>
            )}
            {a.allow_overdraft && a.current_balance >= 0 && (
              <span className="rounded-full bg-brand-surface-hover px-2 py-0.5 font-medium">Sobregiro autorizado</span>
            )}
          </p>
          <p
            className={`whitespace-nowrap text-xl font-semibold tracking-tight tabular-nums ${
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

/** Vista "Lista": una fila por cuenta, para cuando hay muchas cuentas. */
function AccountsTable({ rows }: { rows: AccountRow[] }) {
  const columns: Column<AccountRow>[] = [
    {
      header: "Cuenta",
      accessor: (a) => {
        const isCard = a.type === "CREDIT_CARD";
        return (
          <Link href={`/banks/${a.id}`} className="group flex min-w-[14rem] items-center gap-3">
            <IconBadge icon={isCard ? <CreditCard size={15} /> : <Landmark size={15} />} tone={isCard ? "violet" : "blue"} size="sm" />
            <span className="min-w-0">
              <span className="block truncate font-medium text-brand-text group-hover:text-brand-accent">{a.name}</span>
              <span className="block truncate text-xs text-brand-muted">
                {a.bank_name ?? "Sin banco"}
                {a.account_number_masked ? ` · ${a.account_number_masked}` : ""}
              </span>
            </span>
          </Link>
        );
      },
    },
    {
      header: "Tipo",
      accessor: (a) => (
        <span className="whitespace-nowrap text-brand-muted">
          {a.type === "CREDIT_CARD" ? "Tarjeta de crédito" : a.account_kind ? ACCOUNT_KIND_LABELS[a.account_kind] : "Sin tipo"}
        </span>
      ),
    },
    { header: "Moneda", accessor: (a) => <Badge tone="neutral">{a.currency}</Badge> },
    {
      header: "Saldo / Deuda",
      className: "text-right",
      accessor: (a) => {
        if (a.type === "CREDIT_CARD") {
          const { debt, favor } = cardPosition(a.current_balance, a.credit_limit, a.favor_increases_limit);
          return favor > 0 ? (
            <span className="whitespace-nowrap font-medium tabular-nums text-brand-success">A favor {formatMoney(favor, a.currency)}</span>
          ) : (
            <span className={`whitespace-nowrap font-medium tabular-nums ${debt > 0 ? "text-brand-danger" : "text-brand-text"}`}>
              Deuda {formatMoney(debt, a.currency)}
            </span>
          );
        }
        return (
          <span className={`whitespace-nowrap font-semibold tabular-nums ${a.current_balance < 0 ? "text-brand-danger" : "text-brand-text"}`}>
            {formatMoney(a.current_balance, a.currency)}
          </span>
        );
      },
    },
    {
      header: "Estado",
      accessor: (a) => (
        <span className="flex flex-wrap gap-1">
          {!a.is_active && <Badge tone="neutral">Inactiva</Badge>}
          {a.type === "BANK" && a.current_balance < 0 && <Badge tone="danger">En sobregiro</Badge>}
          {a.uncategorized_count > 0 && <Badge tone="warning">{a.uncategorized_count} sin categoría</Badge>}
          {a.is_active && a.current_balance >= 0 && a.uncategorized_count === 0 && <span className="text-xs text-brand-muted">—</span>}
        </span>
      ),
    },
  ];
  return <DataTable columns={columns} rows={rows} keyFor={(a) => a.id} maxWidth="max-w-none" />;
}

export default async function BanksPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; currency?: string; view?: string }>;
}) {
  const params = await searchParams;
  // Tipo: Ahorros / Corriente / Tarjetas de crédito (CARD).
  const kindFilter =
    params.kind === "SAVINGS" || params.kind === "CHECKING" || params.kind === "CARD" ? params.kind : undefined;
  // Vista: tarjetas (por defecto) o lista compacta para muchas cuentas.
  const listView = params.view === "lista";
  const accounts = await listBankAccountsWithBalance();
  // Monedas con cuentas (catálogo de Configuración → Monedas y tasas).
  const accountCurrencies = Array.from(new Set(accounts.map((a) => a.currency))).sort();
  const currencyFilter = params.currency && accountCurrencies.includes(params.currency) ? params.currency : undefined;
  const allBanks = accounts.filter((a) => a.type !== "CREDIT_CARD");
  const cards = accounts.filter((a) => a.type === "CREDIT_CARD");
  const showBanks = kindFilter !== "CARD";
  const showCards = !kindFilter || kindFilter === "CARD";
  const banks = allBanks.filter(
    (a) =>
      (!kindFilter || kindFilter === "CARD" || a.account_kind === kindFilter) &&
      (!currencyFilter || a.currency === currencyFilter),
  );
  const cardsShown = cards.filter((a) => !currencyFilter || a.currency === currencyFilter);
  // Filtro sin resultados: el siguiente filtro que se elija empieza de cero.
  const noResults =
    Boolean(kindFilter || currencyFilter) &&
    (showBanks ? banks.length : 0) + (showCards ? cardsShown.length : 0) === 0;
  // Conteos de los botones según el otro filtro (tipo ↔ moneda).
  const byCurrency = (a: AccountRow) => !currencyFilter || noResults || a.currency === currencyFilter;
  const view = listView ? "lista" : undefined;
  const activeCards = cards.filter((a) => a.is_active);

  // Dinero disponible: solo cuentas bancarias (ahorro y corriente), por
  // moneda y sin mezclar pesos con dólares. Las tarjetas van aparte.
  const cashDop = availableCash(accounts, "DOP");
  const cashUsd = availableCash(accounts, "USD");
  const debt = splitCurrencies(sumByCurrency(activeCards, (a) => Math.max(0, -a.current_balance)));
  const favorTotal = splitCurrencies(sumByCurrency(activeCards, (a) => Math.max(0, a.current_balance)));
  const hasFavor = activeCards.some((a) => a.current_balance > 0);
  const creditLeft = splitCurrencies(
    sumByCurrency(
      activeCards.filter((a) => a.credit_limit != null),
      (a) => cardPosition(a.current_balance, a.credit_limit, a.favor_increases_limit).available ?? 0,
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
              label="Disponible en pesos"
              value={formatMoney(cashDop.total, "DOP")}
              valueTone={cashDop.total < 0 ? "danger" : undefined}
              hint={cashHint(cashDop, "DOP")}
              icon={<Wallet size={20} />}
              tone="green"
            />
            <StatCard
              label="Disponible en dólares"
              value={formatMoney(cashUsd.total, "USD")}
              valueTone={cashUsd.total < 0 ? "danger" : undefined}
              hint={cashHint(cashUsd, "USD")}
              icon={<DollarSign size={20} />}
              tone="blue"
            />
            <StatCard
              label="Deuda en tarjetas"
              value={debt.main}
              valueTone={debtTotal > 0 ? "danger" : undefined}
              hint={
                [
                  debt.others.length ? `+ ${debt.others.join(" · ")}` : `${activeCards.length} tarjetas activas`,
                  hasFavor ? `Saldo a favor: ${[favorTotal.main, ...favorTotal.others].join(" · ")}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              }
              icon={<CreditCard size={20} />}
              tone="red"
            />
            <StatCard
              label="Crédito disponible"
              value={creditLeft.main}
              hint={creditLeft.others.length ? `+ ${creditLeft.others.join(" · ")}` : "Límite menos deuda (tarjetas con límite)"}
              icon={<ShieldCheck size={20} />}
              tone="violet"
            />
          </StatGrid>
          <p className="-mt-3 text-xs text-brand-muted">
            <strong className="font-medium text-brand-text">Disponible</strong> = suma de las cuentas de ahorro y
            corrientes activas. Los pesos y los dólares se muestran por separado (no se suman entre sí) y las
            tarjetas de crédito no cuentan como dinero disponible. Una cuenta en sobregiro resta.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <FilterPills
                label="Filtrar por tipo de cuenta"
                items={[
                  {
                    key: "all",
                    label: "Todas",
                    count: accounts.filter(byCurrency).length,
                    active: !kindFilter,
                    href: listHref("/banks", { currency: noResults ? undefined : currencyFilter, view }),
                  },
                  ...(["SAVINGS", "CHECKING"] as const).map((k) => ({
                    key: k,
                    label: ACCOUNT_KIND_LABELS[k],
                    count: allBanks.filter((a) => a.account_kind === k && byCurrency(a)).length,
                    active: kindFilter === k,
                    href: listHref("/banks", { kind: k, currency: noResults ? undefined : currencyFilter, view }),
                  })),
                  {
                    key: "CARD",
                    label: "Tarjetas de crédito",
                    count: cards.filter(byCurrency).length,
                    active: kindFilter === "CARD",
                    href: listHref("/banks", { kind: "CARD", currency: noResults ? undefined : currencyFilter, view }),
                  },
                ]}
              />
              <FilterPills
                label="Filtrar por moneda"
                items={[
                  { key: "all", label: "Todas las monedas", active: !currencyFilter, href: listHref("/banks", { kind: noResults ? undefined : kindFilter, view }) },
                  ...accountCurrencies.map((c) => ({
                    key: c,
                    label: c,
                    count: (kindFilter === "CARD" ? cards : kindFilter ? allBanks.filter((a) => a.account_kind === kindFilter) : accounts).filter(
                      (a) => a.currency === c,
                    ).length,
                    active: currencyFilter === c,
                    href: listHref("/banks", { kind: noResults ? undefined : kindFilter, currency: c, view }),
                  })),
                ]}
              />
            </div>
            <nav aria-label="Vista" className="flex gap-1 rounded-full border border-brand-border bg-brand-surface p-1">
              {[
                { key: undefined, label: "Tarjetas", icon: <LayoutGrid size={14} /> },
                { key: "lista", label: "Lista", icon: <List size={14} /> },
              ].map((v) => {
                const active = (v.key === "lista") === listView;
                return (
                  <Link
                    key={v.label}
                    href={listHref("/banks", { kind: kindFilter, currency: currencyFilter, view: v.key })}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                      active ? "bg-brand-primary text-white" : "text-brand-muted hover:text-brand-text"
                    }`}
                  >
                    {v.icon}
                    {v.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {noResults ? (
            <NoResults what="cuentas ni tarjetas" clearHref={listHref("/banks", { view })} />
          ) : (
            <>
              {showBanks && (
                <section>
                  <SectionHeader title="Cuentas bancarias" count={banks.length} />
                  {banks.length === 0 ? (
                    <p className="rounded-[var(--radius-lg)] border border-dashed border-brand-border p-6 text-center text-sm text-brand-muted">
                      {currencyFilter ? `Sin cuentas bancarias en ${currencyFilter}.` : "Sin cuentas bancarias todavía."}
                    </p>
                  ) : listView ? (
                    <AccountsTable rows={banks} />
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {banks.map((a) => (
                        <AccountCard key={a.id} a={a} />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {showCards && (
                <section>
                  <SectionHeader title="Tarjetas de crédito" count={cardsShown.length} />
                  {cardsShown.length === 0 ? (
                    <p className="rounded-[var(--radius-lg)] border border-dashed border-brand-border p-6 text-center text-sm text-brand-muted">
                      {currencyFilter ? `Sin tarjetas en ${currencyFilter}.` : "Sin tarjetas registradas todavía."}
                    </p>
                  ) : listView ? (
                    <AccountsTable rows={cardsShown} />
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {cardsShown.map((a) => (
                        <AccountCard key={a.id} a={a} />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
