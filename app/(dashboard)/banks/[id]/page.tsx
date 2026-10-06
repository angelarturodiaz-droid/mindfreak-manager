import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpRight,
  AlertTriangle,
  ChevronDown,
  CreditCard,
  Landmark,
  Pencil,
  Plus,
} from "lucide-react";
import {
  getBankAccount,
  listBankTransactions,
  listOtherActiveAccounts,
  hasBankTransactions,
  transactionEffect,
} from "@/features/banks/queries";
import { cardPosition } from "@/features/banks/display";
import { toggleBankAccountActiveAction, toggleReconciledAction } from "@/features/banks/actions";
import { hasPermission } from "@/lib/auth/permissions";
import { ManualTransactionForm } from "./manual-transaction-form";
import { TransferForm } from "./transfer-form";
import { getFxContext } from "@/features/currencies/queries";
import { BankAccountEditForm } from "./bank-account-edit-form";
import { listBankCatalog } from "@/features/bank-catalog/queries";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ActionLink } from "@/components/ui/action-link";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { IconBadge } from "@/components/ui/icon-badge";
import {
  Chip,
  FilterPills,
  MetricCard,
  ProgressBar,
  SectionHeader,
  listHref,
} from "@/components/ui/page-kit";
import { formatDate, todayISO } from "@/lib/utils/dates";
import { listCategoryOptions } from "@/features/expense-categories/queries";
import { getCompany } from "@/features/settings/queries";
import { TransactionCategorySelect } from "@/components/banks/transaction-category-select";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { relationName, relationRow } from "@/lib/utils/relation";

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

type TransactionRow = Awaited<ReturnType<typeof listBankTransactions>>[number] & {
  effect: number;
  runningBalance: number | null;
};

const TYPE_FILTERS = [
  { key: undefined, label: "Todos" },
  { key: "INCOME", label: "Ingresos" },
  { key: "EXPENSE", label: "Gastos" },
  { key: "TRANSFER", label: "Transferencias" },
] as const;

/** Qué generó el movimiento, con link cuando aplica. */
function TransactionOrigin({ t }: { t: TransactionRow }) {
  const payment = relationRow<{ invoice_id: string; invoices: unknown }>(t.customer_payments);
  if (t.customer_payment_id && payment) {
    const number = relationRow<{ number: string }>(payment.invoices)?.number;
    return (
      <Link href={`/invoices/${payment.invoice_id}`} className="whitespace-nowrap text-brand-accent hover:underline">
        Factura {number ?? ""}
      </Link>
    );
  }
  if (t.expense_id) {
    const desc = relationRow<{ description: string }>(t.expenses)?.description;
    return (
      <Link href={`/expenses/${t.expense_id}`} className="line-clamp-2 block max-w-[11rem] break-words text-brand-accent hover:underline">
        Gasto: {desc ?? "ver"}
      </Link>
    );
  }
  if (t.supplier_payment_id) {
    const sp = relationRow<{ expense_id: string; expenses: unknown }>(t.supplier_payments);
    const desc = sp ? relationRow<{ description: string }>(sp.expenses)?.description : null;
    return sp?.expense_id ? (
      <Link href={`/expenses/${sp.expense_id}`} className="line-clamp-2 block max-w-[11rem] break-words text-brand-accent hover:underline">
        Pago: {desc ?? "ver gasto"}
      </Link>
    ) : (
      <span className="text-brand-muted">Pago a proveedor</span>
    );
  }
  if (t.type === "TRANSFER") {
    const other = relationName(t.counterpart);
    return other && t.counterpart_account_id ? (
      <Link href={`/banks/${t.counterpart_account_id}`} className="whitespace-nowrap text-brand-accent hover:underline">
        {t.effect < 0 ? "A" : "Desde"} {other}
      </Link>
    ) : (
      <span className="text-brand-muted">Transferencia</span>
    );
  }
  return <span className="text-brand-muted">Manual</span>;
}

export default async function BankAccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; rec?: string; cat?: string }>;
}) {
  const { id } = await params;
  const filters = await searchParams;

  let account;
  try {
    account = await getBankAccount(id);
  } catch {
    notFound();
  }
  if (!account) notFound();

  const [transactions, otherAccounts, canCreate, canReconcile, hasTx, bankCatalog, categories, company, fxContext] = await Promise.all([
    listBankTransactions(id),
    listOtherActiveAccounts(id),
    hasPermission("banks.create"),
    hasPermission("banks.reconcile"),
    hasBankTransactions(id),
    listBankCatalog(),
    listCategoryOptions(),
    getCompany(),
    getFxContext(),
  ]);

  const isCard = account.type === "CREDIT_CARD";
  const { debt, favor, available, usage } = cardPosition(
    Number(account.current_balance),
    account.credit_limit,
    account.favor_increases_limit,
  );

  // Saldo después de cada movimiento: la lista viene del más reciente al más
  // antiguo, así que se parte del balance actual y se va "deshaciendo".
  const effects = transactions.map((t) => transactionEffect(t.type, t.amount));
  const rows: TransactionRow[] = transactions.map((t, i) => ({
    ...t,
    effect: effects[i],
    runningBalance:
      Number(account.current_balance) - effects.slice(0, i).reduce((acc, e) => acc + e, 0),
  }));

  // Operaciones de esta cuenta a las que se les puede ligar una comisión
  // (multimoneda V5, paso 4) y etiqueta de las comisiones ya ligadas.
  const feeLinkMap = new Map<string, { label: string; href: string | null }>();
  for (const t of transactions) {
    const date = formatDate(t.transaction_date);
    const amt = formatMoney(Math.abs(Number(t.amount)), account.currency);
    if (t.customer_payment_id) {
      const p = relationRow<{ invoice_id: string; invoices: unknown }>(t.customer_payments);
      const n = p ? relationRow<{ number: string }>(p.invoices)?.number : null;
      feeLinkMap.set(`customer_payment:${t.customer_payment_id}`, {
        label: `Cobro factura ${n ?? ""} · ${date} · ${amt}`,
        href: p ? `/invoices/${p.invoice_id}` : null,
      });
    } else if (t.supplier_payment_id) {
      const sp = relationRow<{ expense_id: string; expenses: unknown }>(t.supplier_payments);
      const d = sp ? relationRow<{ description: string }>(sp.expenses)?.description : null;
      feeLinkMap.set(`supplier_payment:${t.supplier_payment_id}`, {
        label: `Pago: ${d ?? "proveedor"} · ${date} · ${amt}`,
        href: sp?.expense_id ? `/expenses/${sp.expense_id}` : null,
      });
    } else if (t.type === "TRANSFER" && t.transfer_group_id) {
      const other = relationName(t.counterpart);
      feeLinkMap.set(`bank_transfer:${t.transfer_group_id}`, {
        label: `Transferencia ${Number(t.amount) < 0 ? "a" : "desde"} ${other ?? "otra cuenta"} · ${date} · ${amt}`,
        href: t.counterpart_account_id ? `/banks/${t.counterpart_account_id}` : null,
      });
    }
  }
  const feeLinks = [...feeLinkMap.entries()].slice(0, 40).map(([value, v]) => ({ value, label: v.label }));
  const feeOrigin = (t: TransactionRow) =>
    t.system_concept === "BANK_FEE" && t.related_source_type && t.related_source_id
      ? (feeLinkMap.get(`${t.related_source_type}:${t.related_source_id}`) ?? { label: "Comisión de una operación", href: null })
      : null;

  const typeFilter = ["INCOME", "EXPENSE", "TRANSFER"].includes(filters.type ?? "") ? filters.type : undefined;
  const recFilter = filters.rec === "no" ? "no" : filters.rec === "si" ? "si" : undefined;
  const catFilter = filters.cat || undefined;
  const filtered = rows.filter(
    (t) =>
      (!typeFilter || t.type === typeFilter) &&
      (!catFilter || (catFilter === "none" ? !t.category_id : t.category_id === catFilter)) &&
      (!recFilter || (recFilter === "si" ? t.reconciled : !t.reconciled)),
  );

  const uncategorized = rows.filter((t) => !t.category_id).length;
  // Filtro sin resultados: el siguiente filtro que se elija empieza de cero
  // (no arrastra los otros filtros, que son los que dejaban la lista vacía).
  const noResults = filtered.length === 0 && Boolean(typeFilter || recFilter || catFilter);
  const keep = <T,>(v: T) => (noResults ? undefined : v);
  // Conteos de cada botón según los otros filtros activos (así un 0 avisa antes de hacer clic).
  const matchRec = (t: TransactionRow) => !recFilter || (recFilter === "si" ? t.reconciled : !t.reconciled);
  const matchCat = (t: TransactionRow) => !catFilter || (catFilter === "none" ? !t.category_id : t.category_id === catFilter);
  const matchType = (t: TransactionRow) => !typeFilter || t.type === typeFilter;
  const typeBase = noResults ? rows : rows.filter((t) => matchRec(t) && matchCat(t));
  const recBase = noResults ? rows : rows.filter((t) => matchType(t) && matchCat(t));
  const month = todayISO().slice(0, 7);
  const monthRows = rows.filter((t) => t.transaction_date?.startsWith(month));
  const inMonth = monthRows.filter((t) => t.effect > 0).reduce((a, t) => a + t.effect, 0);
  const outMonth = monthRows.filter((t) => t.effect < 0).reduce((a, t) => a - t.effect, 0);
  const unreconciled = rows.filter((t) => !t.reconciled).length;
  const monthName = new Intl.DateTimeFormat("es-DO", { month: "long", timeZone: "America/Santo_Domingo" }).format(new Date());

  const columns: Column<TransactionRow>[] = [
    { header: "Fecha", accessor: (t) => <span className="whitespace-nowrap text-brand-muted">{formatDate(t.transaction_date)}</span> },
    {
      header: "Movimiento",
      accessor: (t) => {
        const Icon = t.type === "TRANSFER" ? ArrowRightLeft : t.effect >= 0 ? ArrowDownLeft : ArrowUpRight;
        return (
          // Ancho limitado: las descripciones largas bajan a una segunda línea
          // (máx. 2 líneas, el texto completo queda en el tooltip) en vez de
          // empujar la tabla hacia la derecha.
          <div className="flex w-[14rem] items-center gap-3 sm:w-[16rem] xl:w-[20rem]">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                t.type === "TRANSFER"
                  ? "bg-brand-accent-light text-brand-accent"
                  : t.effect >= 0
                    ? "bg-brand-success-bg text-brand-success"
                    : "bg-brand-danger-bg text-brand-danger"
              }`}
              aria-hidden
            >
              <Icon size={15} />
            </span>
            <span className="min-w-0">
              <span className="line-clamp-2 break-words text-brand-text" title={t.description ?? undefined}>
                {t.description ?? "—"}
              </span>
              <span className="text-xs text-brand-muted">
                {TYPE_LABELS[t.type] ?? t.type}
                {t.reference ? ` · Ref. ${t.reference}` : ""}
                {t.type === "TRANSFER" && account.currency !== company.base_currency && Number(t.exchange_rate) !== 1
                  ? ` · Tasa ${Number(t.exchange_rate)}`
                  : ""}
              </span>
            </span>
          </div>
        );
      },
    },
    {
      header: "Origen",
      accessor: (t) => {
        const fee = feeOrigin(t);
        if (!fee) return <TransactionOrigin t={t} />;
        const text = `Comisión de: ${fee.label.split(" · ")[0]}`;
        return fee.href ? (
          <Link href={fee.href} className="line-clamp-2 block max-w-[11rem] break-words text-brand-accent hover:underline">
            {text}
          </Link>
        ) : (
          <span className="text-brand-muted">{text}</span>
        );
      },
    },
    {
      header: "Monto",
      className: "text-right",
      accessor: (t) => (
        <span className={`whitespace-nowrap font-medium tabular-nums ${t.effect >= 0 ? "text-brand-success" : "text-brand-danger"}`}>
          {t.effect >= 0 ? "+" : "−"}
          {formatMoney(Math.abs(t.effect), account.currency)}
        </span>
      ),
    },
    {
      header: "Categoría",
      accessor: (t) =>
        canCreate ? (
          <TransactionCategorySelect
            transactionId={t.id}
            bankAccountId={account.id}
            value={t.category_id}
            categories={categories}
          />
        ) : (
          <span className="text-brand-muted">{relationName(t.expense_categories) ?? "Sin categoría"}</span>
        ),
    },
    ...(typeFilter || recFilter || catFilter
      ? []
      : [
          {
            header: "Saldo",
            className: "text-right",
            accessor: (t: TransactionRow) => (
              <span className="whitespace-nowrap tabular-nums text-brand-muted">
                {t.runningBalance === null ? "—" : formatMoney(t.runningBalance, account.currency)}
              </span>
            ),
          },
        ]),
    {
      header: "Conciliado",
      accessor: (t) =>
        canReconcile ? (
          <ActionLink
            label={t.reconciled ? "✓ Conciliado" : "Marcar"}
            pendingLabel="…"
            className={
              t.reconciled
                ? "rounded-full bg-brand-success-bg px-2.5 py-0.5 text-xs font-medium text-brand-success hover:opacity-80"
                : "rounded-full border border-brand-border px-2.5 py-0.5 text-xs font-medium text-brand-muted hover:border-brand-accent hover:text-brand-accent"
            }
            onAction={toggleReconciledAction.bind(null, t.id, account.id, t.reconciled)}
          />
        ) : (
          <Chip tone={t.reconciled ? "success" : "muted"}>{t.reconciled ? "Conciliado" : "Pendiente"}</Chip>
        ),
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link
        href="/banks"
        className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
      >
        <ArrowLeft size={14} /> Bancos
      </Link>

      <Card className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-4">
          <IconBadge icon={isCard ? <CreditCard size={22} /> : <Landmark size={22} />} tone={isCard ? "violet" : "blue"} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-brand-primary">{account.name}</h1>
              <Badge tone="neutral">
                {isCard
                  ? "Tarjeta de crédito"
                  : account.account_kind === "SAVINGS"
                    ? "Cuenta de ahorros"
                    : account.account_kind === "CHECKING"
                      ? "Cuenta corriente"
                      : "Cuenta bancaria"}
              </Badge>
              <Badge tone="neutral">{account.currency}</Badge>
              {!account.is_active && <Badge tone="danger">Inactiva</Badge>}
              {!isCard && account.allow_overdraft && <Badge tone="neutral">Sobregiro autorizado</Badge>}
              {!isCard && account.current_balance < 0 && <Badge tone="danger">En sobregiro</Badge>}
            </div>
            <p className="mt-1 text-sm text-brand-muted">
              {account.bank_name ?? "Sin banco"}
              {account.account_number_masked && ` · ${account.account_number_masked}`}
            </p>
            {canCreate && (
              <div className="mt-3">
                <ConfirmButton
                  label={account.is_active ? "Desactivar cuenta" : "Activar cuenta"}
                  confirmTitle={`¿${account.is_active ? "Desactivar" : "Activar"} "${account.name}"?`}
                  onConfirm={toggleBankAccountActiveAction.bind(null, account.id, account.is_active)}
                />
              </div>
            )}
          </div>
        </div>
        <div className="w-full min-w-[14rem] text-left sm:w-auto sm:text-right">
          {isCard ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">Deuda actual</p>
              <p className={`whitespace-nowrap text-2xl font-semibold tabular-nums ${debt > 0 ? "text-brand-danger" : "text-brand-text"}`}>
                {formatMoney(debt, account.currency)}
              </p>
              {favor > 0 && (
                <p className="mt-1 text-sm font-medium tabular-nums text-brand-success">
                  Saldo a favor: {formatMoney(favor, account.currency)}
                </p>
              )}
              {account.credit_limit != null && available != null && (
                <div className="mt-2 flex flex-col gap-1">
                  <ProgressBar pct={usage ?? 0} danger={(usage ?? 0) >= 80} />
                  <p className="text-xs text-brand-muted">
                    Disponible {formatMoney(available, account.currency)} · límite{" "}
                    {formatMoney(account.credit_limit, account.currency)}
                    {account.favor_increases_limit && favor > 0 ? " (incluye saldo a favor)" : ""}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">Balance actual</p>
              <p
                className={`whitespace-nowrap text-3xl font-semibold tracking-tight tabular-nums ${
                  account.current_balance < 0 ? "text-brand-danger" : "text-brand-primary"
                }`}
              >
                {formatMoney(account.current_balance, account.currency)}
              </p>
            </>
          )}
        </div>
      </Card>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={`Entradas en ${monthName}`} value={formatMoney(inMonth, account.currency)} tone="success" />
        <MetricCard label={`Salidas en ${monthName}`} value={formatMoney(outMonth, account.currency)} tone={outMonth > 0 ? "danger" : undefined} />
        <MetricCard
          label="Neto del mes"
          value={formatMoney(inMonth - outMonth, account.currency)}
          tone={inMonth - outMonth < 0 ? "danger" : "success"}
        />
        <MetricCard
          label="Sin conciliar"
          value={String(unreconciled)}
          tone={unreconciled > 0 ? "warning" : "success"}
          hint={`de ${rows.length} movimientos`}
        />
      </section>

      {canCreate && (
        <section className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3" aria-label="Acciones de la cuenta">
          <details className="group rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface shadow-[var(--shadow-sm)] open:shadow-[var(--shadow-md)]">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <IconBadge icon={<Plus size={16} />} tone="green" size="sm" />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-brand-text">Movimiento manual</span>
                <span className="block text-xs text-brand-muted">Intereses, comisiones y otros que no vienen de una factura o gasto</span>
              </span>
              <ChevronDown size={16} className="text-brand-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-brand-border p-4">
              <ManualTransactionForm
                bankAccountId={account.id}
                categories={categories}
                accountCurrency={account.currency}
                baseCurrency={company.base_currency}
                feeLinks={feeLinks}
              />
            </div>
          </details>
          <details className="group rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface shadow-[var(--shadow-sm)] open:shadow-[var(--shadow-md)]">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <IconBadge icon={<ArrowRightLeft size={16} />} tone="blue" size="sm" />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-brand-text">
                  Transferir{account.type === "BANK" ? " o pagar tarjeta" : ""}
                </span>
                <span className="block text-xs text-brand-muted">Mueve dinero desde esta cuenta a otra</span>
              </span>
              <ChevronDown size={16} className="text-brand-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-brand-border p-4">
              <TransferForm
                fromAccountId={account.id}
                fromCurrency={account.currency}
                baseCurrency={company.base_currency}
                otherAccounts={otherAccounts}
                rates={fxContext.rates}
              />
            </div>
          </details>
          <details className="group rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface shadow-[var(--shadow-sm)] open:shadow-[var(--shadow-md)]">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <IconBadge icon={<Pencil size={16} />} tone="neutral" size="sm" />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-brand-text">Editar {isCard ? "tarjeta" : "cuenta"}</span>
                <span className="block text-xs text-brand-muted">Nombre, banco, número y límite</span>
              </span>
              <ChevronDown size={16} className="text-brand-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-brand-border p-4">
              <BankAccountEditForm account={account} canEditOpeningBalance={!hasTx} bankCatalog={bankCatalog} />
            </div>
          </details>
        </section>
      )}

      <section className="flex min-w-0 flex-col gap-4">
        <SectionHeader title="Movimientos" count={filtered.length} />
        {uncategorized > 0 && catFilter !== "none" && (
          <Link
            href={listHref(`/banks/${id}`, { cat: "none" })}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-brand-warning/30 bg-brand-warning-bg px-4 py-3 text-sm text-brand-text hover:border-brand-warning/60"
          >
            <span className="inline-flex items-center gap-2 font-medium">
              <AlertTriangle size={16} className="text-brand-warning" />
              {uncategorized === 1
                ? "1 movimiento sin categoría"
                : `${uncategorized} movimientos sin categoría`}
            </span>
            <span className="text-brand-accent">Clasificar ahora →</span>
          </Link>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterPills
            label="Filtrar por tipo"
            items={TYPE_FILTERS.map((f) => ({
              key: f.key ?? "all",
              label: f.label,
              count: f.key ? typeBase.filter((t) => t.type === f.key).length : typeBase.length,
              active: typeFilter === f.key,
              href: listHref(`/banks/${id}`, { type: f.key, rec: keep(recFilter), cat: keep(catFilter) }),
            }))}
          />
          <FilterPills
            label="Filtrar por conciliación"
            items={[
              { key: "all", label: "Todos", active: !recFilter, href: listHref(`/banks/${id}`, { type: keep(typeFilter), cat: keep(catFilter) }) },
              {
                key: "no",
                label: "Sin conciliar",
                count: recBase.filter((t) => !t.reconciled).length,
                active: recFilter === "no",
                href: listHref(`/banks/${id}`, { type: keep(typeFilter), rec: "no", cat: keep(catFilter) }),
              },
              {
                key: "si",
                label: "Conciliados",
                count: recBase.filter((t) => t.reconciled).length,
                active: recFilter === "si",
                href: listHref(`/banks/${id}`, { type: keep(typeFilter), rec: "si", cat: keep(catFilter) }),
              },
            ]}
          />
          <form action={`/banks/${id}`} method="get">
            {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
            {recFilter && <input type="hidden" name="rec" value={recFilter} />}
            <AutoSubmitSelect resetOthers={noResults} name="cat" defaultValue={catFilter ?? ""} className="w-52" aria-label="Filtrar por categoría">
              <option value="">Todas las categorías</option>
              <option value="none">Sin categoría ({rows.filter((t) => !t.category_id).length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </AutoSubmitSelect>
          </form>
        </div>
        <DataTable
          columns={columns}
          rows={filtered}
          keyFor={(t) => t.id}
          maxWidth="max-w-none"
          emptyMessage="Sin movimientos todavía."
          filtered={Boolean(typeFilter || recFilter || catFilter)}
          clearHref={`/banks/${id}`}
          what="movimientos"
        />
      </section>
    </main>
  );
}
