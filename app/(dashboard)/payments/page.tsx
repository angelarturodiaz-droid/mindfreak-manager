import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Scale, TrendingUp } from "lucide-react";
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
] as const;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const activeTab = params.tab === "pagos" ? "pagos" : "cobros";
  const q = cleanSearch(params.q);
  const page = parsePage(params.page);
  // Solo se pide la pestaña abierta (15 por página); las pestañas muestran el total.
  const [list, counts, stats, brandOf] = await Promise.all([
    activeTab === "cobros" ? listCustomerPaymentsPage({ search: q, page }) : listSupplierPaymentsPage({ search: q, page }),
    countPaymentsByKind(),
    getPaymentStats(),
    getBankBrands(),
  ]);
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
        Number(p.amount) > 0 ? (
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
      accessor: (p) => (
        <span className="whitespace-nowrap font-medium tabular-nums text-brand-text">−{formatMoney(p.amount)}</span>
      ),
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Cobros y pagos</h1>
        <p className="text-sm text-brand-muted">
          El dinero que entra (cobros de clientes) y el que sale (pagos a proveedores). Para
          registrar uno nuevo, ve a la factura o al gasto correspondiente.
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
          const count = t.key === "cobros" ? counts.cobros : counts.pagos;
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
              <span className="rounded-full bg-brand-surface-hover px-1.5 text-xs tabular-nums text-brand-muted">
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      <form action="/payments" method="get" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="tab" value={activeTab} />
        <LiveSearchInput
          defaultValue={q ?? ""}
          placeholder={activeTab === "cobros" ? "Buscar cliente o referencia…" : "Buscar proveedor o referencia…"}
          ariaLabel={activeTab === "cobros" ? "Buscar cobro" : "Buscar pago"}
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

      {activeTab === "cobros" ? (
        <section>
          <SectionHeader
            title="Cobros de clientes"
            description="Del más reciente al más antiguo."
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
            description="Del más reciente al más antiguo."
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
