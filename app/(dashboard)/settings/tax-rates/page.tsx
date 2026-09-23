import { listTaxRates } from "@/features/tax-rates/queries";
import {
  setDefaultTaxRateAction,
  toggleTaxRateActiveAction,
} from "@/features/tax-rates/actions";
import { hasPermission } from "@/lib/auth/permissions";
import { TAX_TREATMENT_LABELS } from "@/features/tax-rates/schema";
import { NewTaxRateForm } from "./new-tax-rate-form";
import { Badge } from "@/components/ui/badge";
import { ActionLink } from "@/components/ui/action-link";
import { DataTable, type Column } from "@/components/ui/data-table";

type TaxRateRow = Awaited<ReturnType<typeof listTaxRates>>[number];

export default async function TaxRatesPage() {
  const [rates, canManage] = await Promise.all([
    listTaxRates(false),
    hasPermission("settings.manage"),
  ]);

  const columns: Column<TaxRateRow>[] = [
    { header: "Nombre", accessor: (r) => r.name },
    { header: "Tasa", accessor: (r) => `${r.rate}%` },
    {
      header: "Tratamiento fiscal",
      accessor: (r) => (
        <Badge tone={r.treatment === "GRAVADO" ? "info" : "warning"}>
          {TAX_TREATMENT_LABELS[r.treatment as keyof typeof TAX_TREATMENT_LABELS] ?? r.treatment}
        </Badge>
      ),
    },
    {
      header: "Predeterminada",
      accessor: (r) =>
        r.is_default ? (
          <Badge tone="success">Sí</Badge>
        ) : canManage && r.is_active ? (
          <ActionLink label="Hacer predeterminada" onAction={setDefaultTaxRateAction.bind(null, r.id)} />
        ) : (
          "—"
        ),
    },
    {
      header: "Estado",
      accessor: (r) => <Badge tone={r.is_active ? "success" : "danger"}>{r.is_active ? "Activa" : "Inactiva"}</Badge>,
    },
    {
      header: "",
      className: "text-right",
      accessor: (r) =>
        canManage && (
          <ActionLink
            label={r.is_active ? "Desactivar" : "Activar"}
            className="text-sm text-brand-muted hover:text-brand-danger"
            onAction={toggleTaxRateActiveAction.bind(null, r.id, r.is_active)}
          />
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-brand-primary">
          Tasas de impuesto
        </h2>
        <p className="text-sm text-brand-muted">
          Se usan al agregar líneas en cotizaciones y facturas. Esto no activa la
          facturación fiscal completa (NCF/DGII) — eso sigue pendiente para V2.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={rates}
        keyFor={(r) => r.id}
        maxWidth="max-w-2xl"
        emptyMessage="Sin tasas configuradas todavía."
      />

      {canManage && (
        <section className="max-w-2xl">
          <h2 className="mb-3 text-sm font-medium text-brand-text">Nueva tasa</h2>
          <NewTaxRateForm />
        </section>
      )}
    </div>
  );
}
