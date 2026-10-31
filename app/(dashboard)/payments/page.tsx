import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, HandCoins, Plus, Scale, ShieldCheck, TrendingUp } from "lucide-react";
import { countPendingCorrections, listCorrectionHistory, listPendingCorrections } from "@/features/corrections/queries";
import { CorrectionCard } from "@/components/corrections/correction-card";
import { getCurrentUser } from "@/lib/auth/permissions";
import { countAdvances, getAdvanceTotals, listAdvancesPage } from "@/features/advances/queries";
import { AdvanceTable } from "@/components/advances/advance-table";
import { Callout } from "@/components/ui/page-kit";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/lib/auth/permissions";
import {
  listCustomerPaymentsPage,
  listSupplierPaymentsPage,
  countPaymentsByKind,
  getPaymentStats,
} from "@/features/payments/queries";
import { LiveSearchInput } from "@/components/ui/live-search-input";
import { Pagination } from "@/components/ui/pagination";
import { parsePage } from "@/lib/utils/pagination";
import { cleanSearch } from "@/lib/utils/search";
import { PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { RegisteredDate } from "@/components/ui/registered-date";
import { DataTable, type Column } from "@/components/ui/data-table";
import { InitialsAvatar, SectionHeader, StatCard, StatGrid } from "@/components/ui/page-kit";
import { relationName, relationRow } from "@/lib/utils/relation";
import { formatDate } from "@/lib/utils/dates";
import { getBankBrands } from "@/features/bank-catalog/queries";
import { BankMark } from "@/components/banks/bank-mark";
import type { BankBrand } from "@/features/bank-catalog/branding";

function formatMoney(amount: number, currency = "DOP") {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(amount);
}

/** Moneda de la factura del cobro (el monto y la retención van en esa moneda). */
function invoiceCurrency(p: { invoices: unknown }) {
  return relationRow<{ currency: string | null }>(p.invoices)?.currency ?? "DOP";
}

type PaymentRow = Awaited<ReturnType<typeof listCustomerPaymentsPage>>["rows"][number];
type SupplierPaymentRow = Awaited<ReturnType<typeof listSupplierPaymentsPage>>["rows"][number];

/** Cuenta con el cuadrito de su banco (logo o iniciales en su color). */
function BankCell({ bankAccounts, brandOf }: { bankAccounts: unknown; brandOf: (n: string | null) => BankBrand | null }) {
  const a = relationRow<{ name: string; bank_name: string | null }>(bankAccounts);
  if (!a) return <span className="text-brand-muted">—</span>;
  return (
    <span className="flex items-center gap-2" title={a.bank_name ?? undefined}>
      <BankMark brand={brandOf(a.bank_name)} size={22} />
      <span className="text-brand-muted">{a.name}</span>
    </span>
  );
}

const TABS = [
  { key: "cobros", label: "Cobros de clientes", icon: ArrowDownLeft },
  { key: "pagos", label: "Pagos a proveedores", icon: ArrowUpRight },
  { key: "anticipos", label: "Anticipos de clientes", icon: HandCoins },
  { key: "correcciones", label: "Correcciones", icon: ShieldCheck },
] as const;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string; ver?: string }>;
}) {
  const params = await searchParams;
  const activeTab =
    params.tab === "pagos"
      ? "pagos"
      : params.tab === "anticipos"
        ? "anticipos"
        : params.tab === "correcciones"
          ? "correcciones"
          : "cobros";
  const onlyAvailable = params.ver !== "todos";
  const q = cleanSearch(params.q);
  const page = parsePage(params.page);
  // Solo se pide la pestaña abierta (15 por página); las pestañas muestran el total.
  const [list, counts, stats, brandOf, advanceCount, advanceTotals, canPay] = await Promise.all([
    activeTab === "cobros"
      ? listCustomerPaymentsPage({ search: q, page })
      : activeTab === "pagos"
        ? listSupplierPaymentsPage({ search: q, page })
        : activeTab === "correcciones"
          ? listCorrectionHistory(page)
          : listAdvancesPage({ search: q, page, onlyAvailable }),
    countPaymentsByKind(),
    getPaymentStats(),
    getBankBrands(),
    countAdvances().catch(() => 0),
    getAdvanceTotals().catch(() => ({ sinAplicar: 0, sinAplicarCount: 0 })),
    hasPermission("payments.create"),
  ]);
  // V1-4: correcciones con doble aprobación.
  const [pendingCorrections, pendingCount, canApproveCorrections, me] = await Promise.all([
    activeTab === "correcciones" ? listPendingCorrections().catch(() => []) : Promise.resolve([]),
    countPendingCorrections().catch(() => 0),
    hasPermission("payments.void"),
    getCurrentUser(),
  ]);
  const correctionHistory =
    activeTab === "correcciones" ? (list.rows as Awaited<ReturnType<typeof listCorrectionHistory>>["rows"]) : [];
  const advances = activeTab === "anticipos" ? (list.rows as Awaited<ReturnType<typeof listAdvancesPage>>["rows"]) : [];
  const payments = activeTab === "cobros" ? (list.rows as PaymentRow[]) : [];
  const supplierPayments = activeTab === "pagos" ? (list.rows as SupplierPaymentRow[]) : [];
  const monthName = new Intl.DateTimeFormat("es-DO", {
    month: "long",
    timeZone: "America/Santo_Domingo",
  }).format(new Date());

  const paymentColumns: Column<PaymentRow>[] = [
    { header: "Fecha", accessor: (p) => <RegisteredDate date={p.payment_date} createdAt={p.created_at} /> },
    {
      header: "Cliente",
      accessor: (p) => {
        const name = relationName(p.clients);
        return name ? (
          <span className="flex items-center gap-2">
            <InitialsAvatar name={name} size="sm" />
            <span className="text-brand-text">{name}</span>
          </span>
        ) : (
          <span className="text-brand-muted">—</span>
        );
      },
    },
    {
      header: "Factura",
      accessor: (p) => (
        <Link href={`/invoices/${p.invoice_id}`} className="font-medium text-brand-accent hover:underline">
          {relationRow<{ number: string }>(p.invoices)?.number ?? "—"}
        </Link>
      ),
    },
    { header: "Método", accessor: (p) => <span className="text-brand-muted">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span> },
    {
      header: "Depositado en",
      accessor: (p) => <BankCell bankAccounts={p.bank_accounts} brandOf={brandOf} />,
    },
    {
      header: "Recibido",
      info: "El dinero que pagó el cliente en ese cobro, en la moneda de la factura. «Solo retención» = no pagó dinero, solo se aplicó una retención (recibido 0).",
      className: "text-right",
      accessor: (p) =>
        p.status === "VOIDED" ? (
          <span className="flex flex-col items-end gap-0.5">
            <span className="whitespace-nowrap tabular-nums text-brand-muted line-through">
              {formatMoney(Number(p.amount), invoiceCurrency(p))}
            </span>
            <span className="rounded-full bg-brand-danger-bg px-2 py-0.5 text-xs font-medium text-brand-danger">Anulado</span>
          </span>
        ) : Number(p.amount) > 0 ? (
          <span className="whitespace-nowrap font-medium tabular-nums text-brand-success">
            +{formatMoney(Number(p.amount), invoiceCurrency(p))}
          </span>
        ) : (
          <span
            className="whitespace-nowrap rounded-full bg-brand-warning-bg px-2 py-0.5 text-xs font-medium text-brand-warning"
            title="El cliente no pagó dinero en este cobro: solo se aplicó una retención (no entra al banco)."
          >
            Solo retención
          </span>
        ),
    },
    {
      header: "Retenciones",
      info: "ITBIS o ISR que el cliente retuvo y paga a la DGII. Rebaja la factura, pero no entra al banco. El detalle y el certificado están en la factura.",
      className: "text-right",
      accessor: (p) =>
        Number(p.withholding_total) > 0 ? (
          <span
            className="whitespace-nowrap rounded-full bg-brand-accent-light px-2 py-0.5 text-xs font-medium tabular-nums text-brand-accent"
            title="Lo que el cliente retuvo y pagó a la DGII. Rebaja la factura, pero no entra al banco."
          >
            + {formatMoney(Number(p.withholding_total), invoiceCurrency(p))}
          </span>
        ) : (
          <span className="text-brand-muted">—</span>
        ),
    },
  ];

  const supplierPaymentColumns: Column<SupplierPaymentRow>[] = [
    { header: "Fecha", accessor: (p) => <RegisteredDate date={p.payment_date} createdAt={p.created_at} /> },
    {
      header: "Proveedor",
      accessor: (p) => {
        const name = relationName(p.suppliers);
        return name ? (
          <span className="flex items-center gap-2">
            <InitialsAvatar name={name} size="sm" />
            <span className="text-brand-text">{name}</span>
          </span>
        ) : (
          <span className="text-brand-muted">—</span>
        );
      },
    },
    {
      header: "Gasto",
      accessor: (p) => (
        <Link href={`/expenses/${p.expense_id}`} className="text-brand-accent hover:underline">
          {relationRow<{ description: string }>(p.expenses)?.description ?? "—"}
        </Link>
      ),
    },
    { header: "Método", accessor: (p) => <span className="text-brand-muted">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span> },
    {
      header: "Pagado desde",
      accessor: (p) => <BankCell bankAccounts={p.bank_accounts} brandOf={brandOf} />,
    },
    {
      header: "Monto",
      className: "text-right",
      accessor: (p) =>
        p.status === "VOIDED" ? (
          <span className="flex flex-col items-end gap-0.5">
            <span className="whitespace-nowrap tabular-nums text-brand-muted line-through">{formatMoney(p.amount)}</span>
            <span className="rounded-full bg-brand-danger-bg px-2 py-0.5 text-xs font-medium text-brand-danger">Anulado</span>
          </span>
        ) : (
          <span className="whitespace-nowrap font-medium tabular-nums text-brand-text">−{formatMoney(p.amount)}</span>
        ),
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Cobros y pagos</h1>
        <p className="text-sm text-brand-muted">
          El dinero que entra (cobros de clientes y anticipos) y el que sale (pagos a proveedores). Para
          registrar un cobro o un pago, ve a la factura o al gasto; un anticipo se registra aquí, en el proyecto o en
          la cotización.
        </p>
      </div>

      <StatGrid>
        <StatCard
          label={`Cobrado en ${monthName}`}
          value={formatMoney(stats.cobradoMes)}
          valueTone="success"
          hint={`${stats.cobradoMesCount} ${stats.cobradoMesCount === 1 ? "cobro" : "cobros"}`}
          icon={<ArrowDownLeft size={20} />}
          tone="green"
        />
        <StatCard
          label={`Pagado en ${monthName}`}
          value={formatMoney(stats.pagadoMes)}
          hint={`${stats.pagadoMesCount} ${stats.pagadoMesCount === 1 ? "pago" : "pagos"} a proveedores`}
          icon={<ArrowUpRight size={20} />}
          tone="amber"
        />
        <StatCard
          label="Neto del mes"
          value={formatMoney(stats.netoMes)}
          valueTone={stats.netoMes < 0 ? "danger" : "success"}
          hint="Cobrado − pagado"
          icon={<Scale size={20} />}
          tone={stats.netoMes < 0 ? "red" : "blue"}
        />
        <StatCard
          label="Cobrado en el año"
          value={formatMoney(stats.cobradoAnio)}
          hint="Desde el 1 de enero"
          icon={<TrendingUp size={20} />}
          tone="violet"
        />
      </StatGrid>

      <nav aria-label="Tipo de movimiento" className="flex gap-1 overflow-x-auto border-b border-brand-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          const count =
            t.key === "cobros"
              ? counts.cobros
              : t.key === "pagos"
                ? counts.pagos
                : t.key === "correcciones"
                  ? pendingCount
                  : advanceCount;
          return (
            <Link
              key={t.key}
              href={`/payments?tab=${t.key}`}
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "border-brand-accent font-medium text-brand-accent"
                  : "border-transparent text-brand-muted hover:text-brand-text"
              }`}
            >
              <Icon size={15} aria-hidden />
              {t.label}
              <span
                title={t.key === "correcciones" ? "Correcciones esperando aprobación" : undefined}
                className={`rounded-full px-1.5 text-xs tabular-nums ${
                  t.key === "correcciones" && count > 0
                    ? "bg-brand-warning-bg font-semibold text-brand-warning"
                    : "bg-brand-surface-hover text-brand-muted"
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {activeTab !== "correcciones" && (
      <form action="/payments" method="get" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="tab" value={activeTab} />
        <LiveSearchInput
          defaultValue={q ?? ""}
          placeholder={
            activeTab === "pagos" ? "Buscar proveedor o referencia…" : activeTab === "anticipos" ? "Buscar cliente o ANT…" : "Buscar cliente o referencia…"
          }
          ariaLabel={activeTab === "cobros" ? "Buscar cobro" : activeTab === "anticipos" ? "Buscar anticipo" : "Buscar pago"}
          className="w-72"
        />
        {q && (
          <span className="text-sm text-brand-muted">
            {list.total} {list.total === 1 ? "resultado" : "resultados"} con “<span className="font-medium text-brand-text">{q}</span>” ·{" "}
            <Link href={`/payments?tab=${activeTab}`} className="text-brand-accent hover:underline">
              Quitar búsqueda
            </Link>
          </span>
        )}
      </form>
      )}

      {activeTab === "correcciones" ? (
        <section className="flex flex-col gap-4">
          <Callout
            icon={<ShieldCheck size={18} />}
            title="Correcciones con doble aprobación"
            description="Si un cobro, un pago a proveedor o un movimiento manual de banco se registró mal, se pide la corrección desde el mismo registro con el botón «Corregir». Otra persona de Administración o Finanzas la aprueba aquí (nunca quien la pidió). Mientras está pendiente no cambia nada; al aprobarse se aplica sola y nada se borra: lo anulado queda tachado y el banco lleva un «Reverso»."
          />
          <div>
            <SectionHeader
              title="Por aprobar"
              count={pendingCorrections.length}
              description={
                canApproveCorrections
                  ? "Revisa el antes y el después de cada una y pulsa Aprobar o Rechazar."
                  : "Las aprueba Administración o Finanzas. Tú puedes retirar las que pediste."
              }
            />
            {pendingCorrections.length === 0 ? (
              <p className="rounded-[var(--radius-lg)] border border-dashed border-brand-border p-6 text-center text-sm text-brand-muted">
                No hay correcciones esperando aprobación. 👍
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {pendingCorrections.map((r) => (
                  <CorrectionCard key={r.id} row={r} currentUserId={me?.id ?? ""} canApprove={canApproveCorrections} />
                ))}
              </div>
            )}
          </div>
          <div>
            <SectionHeader title="Historial" description="Ya decididas o retiradas. Lo último primero." />
            {correctionHistory.length === 0 ? (
              <p className="rounded-[var(--radius-lg)] border border-dashed border-brand-border p-6 text-center text-sm text-brand-muted">
                Todavía no hay correcciones en el historial.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {correctionHistory.map((r) => (
                  <CorrectionCard key={r.id} row={r} currentUserId={me?.id ?? ""} canApprove={false} />
                ))}
              </div>
            )}
            <div className="mt-4">
              <Pagination basePath="/payments" page={page} pageSize={list.pageSize} total={list.total} params={{ tab: "correcciones" }} />
            </div>
          </div>
        </section>
      ) : activeTab === "anticipos" ? (
        <section className="flex flex-col gap-4">
          <Callout
            icon={<HandCoins size={18} />}
            title={
              advanceTotals.sinAplicar > 0
                ? `Anticipos sin aplicar: ${formatMoney(advanceTotals.sinAplicar)} (${advanceTotals.sinAplicarCount} ${advanceTotals.sinAplicarCount === 1 ? "anticipo" : "anticipos"})`
                : "No hay anticipos esperando factura"
            }
            description="Dinero que los clientes entregaron antes de la factura (recibos ANT, sin impuestos). No es venta todavía: cuando emitas la factura final, ábrela y pulsa «Aplicar anticipos». En pesos, con la tasa del día de cada anticipo."
          >
            {canPay && (
              <Link href="/advances/new">
                <Button size="sm" icon={<Plus size={14} />}>
                  Registrar anticipo
                </Button>
              </Link>
            )}
          </Callout>
          <div>
            <SectionHeader
              title={onlyAvailable ? "Anticipos con saldo disponible" : "Todos los anticipos"}
              description={
                <>
                  Lo último registrado primero ·{" "}
                  <Link
                    href={`/payments?tab=anticipos${onlyAvailable ? "&ver=todos" : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                    className="text-brand-accent hover:underline"
                  >
                    {onlyAvailable ? "Ver también los ya aplicados o devueltos" : "Ver solo los que tienen saldo"}
                  </Link>
                </>
              }
            />
            <AdvanceTable
              rows={advances}
              showClient
              emptyMessage={
                q
                  ? "Ningún anticipo coincide con la búsqueda."
                  : onlyAvailable
                    ? "No hay anticipos con saldo disponible."
                    : "Aún no se ha registrado ningún anticipo."
              }
            />
            <div className="mt-4">
              <Pagination
                basePath="/payments"
                page={page}
                pageSize={list.pageSize}
                total={list.total}
                params={{ tab: "anticipos", q, ver: onlyAvailable ? undefined : "todos" }}
              />
            </div>
          </div>
        </section>
      ) : activeTab === "cobros" ? (
        <section>
          <SectionHeader
            title="Cobros de clientes"
            description="Lo último registrado primero."
          />
          <DataTable
            columns={paymentColumns}
            rows={payments}
            keyFor={(p) => p.id}
            maxWidth="max-w-none"
            emptyMessage={q ? "Ningún cobro coincide con la búsqueda." : "Aún no se ha registrado ningún cobro."}
          />
          <div className="mt-4">
            <Pagination basePath="/payments" page={page} pageSize={list.pageSize} total={list.total} params={{ tab: "cobros", q }} />
          </div>
        </section>
      ) : (
        <section>
          <SectionHeader
            title="Pagos a proveedores"
            description="Lo último registrado primero."
          />
          <DataTable
            columns={supplierPaymentColumns}
            rows={supplierPayments}
            keyFor={(p) => p.id}
            maxWidth="max-w-none"
            emptyMessage={q ? "Ningún pago coincide con la búsqueda." : "Aún no se ha registrado ningún pago a proveedor."}
          />
          <div className="mt-4">
            <Pagination basePath="/payments" page={page} pageSize={list.pageSize} total={list.total} params={{ tab: "pagos", q }} />
          </div>
        </section>
      )}
    </main>
  );
}
