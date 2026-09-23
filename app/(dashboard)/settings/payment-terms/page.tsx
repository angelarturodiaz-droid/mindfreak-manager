import { listPaymentTerms } from "@/features/payment-terms/queries";
import {
  togglePaymentTermActiveAction,
  deletePaymentTermAction,
} from "@/features/payment-terms/actions";
import { PAYMENT_METHOD_LABELS } from "@/features/payment-terms/schema";
import { NewPaymentTermForm } from "./new-payment-term-form";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ActionButton } from "@/components/ui/action-button";
import { DataTable, type Column } from "@/components/ui/data-table";

type Term = Awaited<ReturnType<typeof listPaymentTerms>>[number];

export default async function PaymentTermsSettingsPage() {
  const terms = await listPaymentTerms(false);

  const columns: Column<Term>[] = [
    { header: "Nombre", accessor: (t) => t.name },
    { header: "Días de crédito", accessor: (t) => t.credit_days },
    { header: "Forma de pago", accessor: (t) => <span className="text-brand-muted">{PAYMENT_METHOD_LABELS[t.payment_method] ?? t.payment_method}</span> },
    { header: "% Anticipo", accessor: (t) => `${t.advance_percent}%` },
    { header: "% Saldo", accessor: (t) => `${t.balance_percent}%` },
    {
      header: "Estado",
      accessor: (t) => <Badge tone={t.is_active ? "success" : "danger"}>{t.is_active ? "Activo" : "Inactivo"}</Badge>,
    },
    {
      header: "",
      className: "text-right",
      accessor: (t) => (
        <div className="flex justify-end gap-3">
          <ActionButton
            label={t.is_active ? "Desactivar" : "Activar"}
            variant="ghost"
            onAction={togglePaymentTermActiveAction.bind(null, t.id, t.is_active)}
          />
          <ConfirmButton
            label="Eliminar"
            confirmTitle={`¿Eliminar "${t.name}"?`}
            confirmMessage="Las cotizaciones/facturas que ya la usen no se ven afectadas."
            onConfirm={deletePaymentTermAction.bind(null, t.id)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-brand-primary">
          Condiciones de pago
        </h2>
        <p className="text-sm text-brand-muted">
          Se usan al crear una cotización o factura — el vencimiento de la
          factura se calcula automáticamente según los días de crédito.
        </p>
      </div>

      <DataTable columns={columns} rows={terms} keyFor={(t) => t.id} maxWidth="max-w-4xl" emptyMessage="Sin condiciones de pago todavía." />

      <section className="max-w-3xl">
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Agregar condición de pago
        </h2>
        <NewPaymentTermForm />
      </section>
    </div>
  );
}
