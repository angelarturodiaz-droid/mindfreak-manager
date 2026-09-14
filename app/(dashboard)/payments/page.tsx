import Link from "next/link";
import { listAllPayments, listAllSupplierPayments } from "@/features/payments/queries";
import { PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { DataTable, type Column } from "@/components/ui/data-table";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" }).format(
    amount,
  );
}

type PaymentRow = Awaited<ReturnType<typeof listAllPayments>>[number];
type SupplierPaymentRow = Awaited<ReturnType<typeof listAllSupplierPayments>>[number];

function bankLabel(
  bankAccounts: { name: string; bank_name: string | null } | { name: string; bank_name: string | null }[] | null,
) {
  const a = Array.isArray(bankAccounts) ? bankAccounts[0] : bankAccounts;
  if (!a) return "—";
  return a.bank_name ? `${a.name} (${a.bank_name})` : a.name;
}

export default async function PaymentsPage() {
  const [payments, supplierPayments] = await Promise.all([
    listAllPayments(),
    listAllSupplierPayments(),
  ]);

  const paymentColumns: Column<PaymentRow>[] = [
    { header: "Fecha", accessor: (p) => p.payment_date },
    {
      header: "Factura",
      accessor: (p) => {
        const invoiceData = p.invoices as { number: string }[] | { number: string } | null;
        const invoiceNumber = Array.isArray(invoiceData) ? invoiceData[0]?.number : invoiceData?.number;
        return (
          <Link href={`/invoices/${p.invoice_id}`} className="text-brand-accent hover:underline">
            {invoiceNumber ?? "—"}
          </Link>
        );
      },
    },
    {
      header: "Cliente",
      accessor: (p) => {
        const clientData = p.clients as { name: string }[] | { name: string } | null;
        const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name;
        return <span className="text-brand-muted">{clientName ?? "—"}</span>;
      },
    },
    { header: "Monto", accessor: (p) => <span className="font-medium">{formatMoney(p.amount)}</span> },
    { header: "Método", accessor: (p) => <span className="text-brand-muted">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span> },
    {
      header: "Depositado en",
      accessor: (p) => <span className="text-brand-muted">{bankLabel(p.bank_accounts)}</span>,
    },
  ];

  const supplierPaymentColumns: Column<SupplierPaymentRow>[] = [
    { header: "Fecha", accessor: (p) => p.payment_date },
    {
      header: "Gasto",
      accessor: (p) => {
        const expenseData = p.expenses as { description: string }[] | { description: string } | null;
        const expenseDescription = Array.isArray(expenseData) ? expenseData[0]?.description : expenseData?.description;
        return (
          <Link href={`/expenses/${p.expense_id}`} className="text-brand-accent hover:underline">
            {expenseDescription ?? "—"}
          </Link>
        );
      },
    },
    {
      header: "Proveedor",
      accessor: (p) => {
        const supplierData = p.suppliers as { name: string }[] | { name: string } | null;
        const supplierName = Array.isArray(supplierData) ? supplierData[0]?.name : supplierData?.name;
        return <span className="text-brand-muted">{supplierName ?? "—"}</span>;
      },
    },
    { header: "Monto", accessor: (p) => <span className="font-medium">{formatMoney(p.amount)}</span> },
    { header: "Método", accessor: (p) => <span className="text-brand-muted">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span> },
    {
      header: "Pagado desde",
      accessor: (p) => <span className="text-brand-muted">{bankLabel(p.bank_accounts)}</span>,
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">
          Cobros y pagos
        </h1>
        <p className="text-sm text-brand-muted">
          Historial de cobros y pagos a proveedores registrados. Para
          registrar uno nuevo, ve a la factura o al gasto correspondiente.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-brand-primary">Cobros</h2>
        <DataTable
          columns={paymentColumns}
          rows={payments}
          keyFor={(p) => p.id}
          maxWidth="max-w-4xl"
          emptyMessage="Aún no se ha registrado ningún cobro."
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-brand-primary">
          Pagos a proveedores
        </h2>
        <p className="mb-3 text-sm text-brand-muted">
          Historial de pagos registrados. Para registrar uno nuevo, ve al
          gasto correspondiente.
        </p>
        <DataTable
          columns={supplierPaymentColumns}
          rows={supplierPayments}
          keyFor={(p) => p.id}
          maxWidth="max-w-4xl"
          emptyMessage="Aún no se ha registrado ningún pago a proveedor."
        />
      </div>
    </main>
  );
}
