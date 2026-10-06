import { getCompany } from "@/features/settings/queries";
import { getCurrencySettings, listCurrencies, listExchangeRates } from "@/features/currencies/queries";
import { deleteExchangeRateAction, toggleCurrencyActiveAction } from "@/features/currencies/actions";
import { RATE_SOURCE_LABELS, describeRate, type RateSource } from "@/features/currencies/schema";
import { hasPermission } from "@/lib/auth/permissions";
import { todayISO } from "@/lib/utils/dates";
import { FIELD_HINTS } from "@/lib/ui/field-hints";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ActionLink } from "@/components/ui/action-link";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { InfoHint } from "@/components/ui/info-hint";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SectionHeader } from "@/components/ui/page-kit";
import { CurrencySettingsForm } from "./currency-settings-form";
import { NewCurrencyForm } from "./new-currency-form";
import { ExchangeRateForm } from "./exchange-rate-form";

/**
 * Configuración → Monedas y tasas (multimoneda operacional V5, paso 1).
 * Catálogo de monedas, fuente de la tasa de referencia, tolerancia de
 * redondeo y tasas de referencia por fecha.
 */
export default async function CurrenciesSettingsPage() {
  const [company, settings, currencies, rates, canManage] = await Promise.all([
    getCompany(),
    getCurrencySettings(),
    listCurrencies(false),
    listExchangeRates(60),
    hasPermission("settings.manage"),
  ]);
  const functional = company.base_currency;
  const today = todayISO();
  const foreignActive = currencies.filter((c) => c.is_active && c.code !== functional).map((c) => c.code);

  // Última tasa registrada por moneda (la lista viene de la más reciente a la más vieja).
  const latest = new Map<string, (typeof rates)[number]>();
  for (const r of rates) if (!latest.has(r.currency_code)) latest.set(r.currency_code, r);

  type CurrencyRow = (typeof currencies)[number];
  const currencyColumns: Column<CurrencyRow>[] = [
    {
      header: "Moneda",
      accessor: (c) => (
        <span className="flex items-center gap-2">
          <span className="font-mono font-semibold">{c.code}</span>
          {c.code === functional && <Badge tone="info">Funcional</Badge>}
        </span>
      ),
    },
    { header: "Nombre", accessor: (c) => c.name },
    { header: "Símbolo", accessor: (c) => c.symbol || "—" },
    { header: "Decimales", className: "text-right", accessor: (c) => c.decimals },
    {
      header: "Estado",
      accessor: (c) => <Badge tone={c.is_active ? "success" : "neutral"}>{c.is_active ? "Activa" : "Inactiva"}</Badge>,
    },
    {
      header: "",
      className: "text-right",
      accessor: (c) =>
        canManage && c.code !== functional ? (
          <ActionLink
            label={c.is_active ? "Desactivar" : "Activar"}
            hint={
              c.is_active
                ? "La moneda deja de aparecer para elegir en cuentas y documentos nuevos. Lo ya registrado en esta moneda no cambia."
                : "La moneda vuelve a aparecer para elegir en cuentas y documentos nuevos."
            }
            className="text-sm text-brand-muted hover:text-brand-danger"
            onAction={toggleCurrencyActiveAction.bind(null, c.id)}
          />
        ) : null,
    },
  ];

  type RateRow = (typeof rates)[number];
  const rateColumns: Column<RateRow>[] = [
    { header: "Fecha", accessor: (r) => r.effective_date },
    { header: "Moneda", accessor: (r) => <span className="font-mono">{r.currency_code}</span> },
    {
      header: "Tasa",
      className: "text-right",
      accessor: (r) => <span className="tabular-nums">{describeRate(r.currency_code, r.rate_to_base, functional)}</span>,
    },
    {
      header: "Fuente",
      accessor: (r) =>
        [RATE_SOURCE_LABELS[r.source as RateSource] ?? r.source, r.source_name].filter(Boolean).join(" · "),
    },
    {
      header: "",
      className: "text-right",
      accessor: (r) =>
        canManage ? (
          <ConfirmButton
            label="Borrar"
            variant="secondary"
            hint="Borra esta tasa de referencia. Los pagos y cobros ya registrados guardan su propia tasa y no cambian."
            confirmTitle={`¿Borrar la tasa de ${r.currency_code} del ${r.effective_date}?`}
            confirmMessage="Las operaciones ya registradas guardan su propia tasa y no cambian."
            onConfirm={deleteExchangeRateAction.bind(null, r.id)}
            successMessage="Tasa borrada."
          />
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold text-brand-primary">Monedas y tasas</h2>
        <p className="max-w-3xl text-sm text-brand-muted">
          Aquí defines con qué monedas trabaja la empresa y la tasa de referencia de cada día. Regla del sistema: el
          saldo de una cuenta bancaria solo se mueve en su propia moneda. Cada operación guarda la tasa que usó, así
          que cambiar algo aquí no modifica lo ya registrado.
        </p>
      </div>

      <section>
        <SectionHeader title="Configuración" description="Moneda funcional, de dónde sale la tasa de referencia y tolerancia de redondeo." />
        <Card>
          <CurrencySettingsForm functional={functional} settings={settings} canManage={canManage} />
        </Card>
      </section>

      <section>
        <SectionHeader
          title="Tasas de referencia"
          description={
            <>
              Una tasa por moneda y día, siempre como <strong>1 unidad de la moneda = X {functional}</strong>.{" "}
              <InfoHint text={FIELD_HINTS.referenceRate} />
            </>
          }
        />
        {foreignActive.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-3">
            {foreignActive.map((code) => {
              const r = latest.get(code);
              return (
                <Card key={code} className="min-w-56">
                  <p className="text-xs uppercase tracking-wide text-brand-muted">Última tasa {code}</p>
                  {r ? (
                    <>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-brand-text">
                        {describeRate(code, r.rate_to_base, functional)}
                      </p>
                      <p className="text-xs text-brand-muted">
                        {r.effective_date}
                        {r.effective_date !== today && " · no es de hoy"} · {RATE_SOURCE_LABELS[r.source as RateSource] ?? r.source}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-brand-warning">Sin tasa registrada</p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
        {canManage && (
          <Card className="mb-4">
            <ExchangeRateForm
              currencies={foreignActive}
              functional={functional}
              defaultSource={settings.reference_rate_source}
              defaultSourceName={settings.reference_source_name}
              today={today}
            />
          </Card>
        )}
        <DataTable
          columns={rateColumns}
          rows={rates}
          keyFor={(r) => r.id}
          maxWidth="max-w-4xl"
          emptyMessage="Todavía no hay tasas registradas."
        />
      </section>

      <section>
        <SectionHeader
          title="Monedas"
          count={currencies.filter((c) => c.is_active).length}
          description={
            <>
              Las activas aparecen al crear cuentas, cotizaciones, facturas y gastos. <InfoHint text={FIELD_HINTS.currencyCatalog} />
            </>
          }
        />
        <DataTable columns={currencyColumns} rows={currencies} keyFor={(c) => c.id} maxWidth="max-w-3xl" />
        {canManage && (
          <div className="mt-4 max-w-3xl">
            <NewCurrencyForm />
          </div>
        )}
      </section>
    </div>
  );
}
