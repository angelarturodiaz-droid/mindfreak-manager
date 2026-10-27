import Link from "next/link";
import { ArrowLeft, HandCoins } from "lucide-react";
import { hasPermission } from "@/lib/auth/permissions";
import { listActiveClients } from "@/features/quotations/queries";
import { listAdvanceTargets } from "@/features/advances/queries";
import { listBankAccounts } from "@/features/payments/queries";
import { getAccountFunds } from "@/features/banks/queries";
import { getFxContext, listCurrencyOptions } from "@/features/currencies/queries";
import { safeReturnTo } from "@/lib/utils/return-to";
import { Card } from "@/components/ui/card";
import { Callout } from "@/components/ui/page-kit";
import { NewAdvanceForm } from "./new-advance-form";

/**
 * Registrar anticipo de cliente (V1-3). Se llega desde el proyecto, la
 * cotización aprobada o Cobros y pagos; con ?project= / ?quotation= /
 * ?client= el formulario ya viene elegido.
 */
export default async function NewAdvancePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; quotation?: string; client?: string; return_to?: string }>;
}) {
  const sp = await searchParams;
  const canCreate = await hasPermission("payments.create");
  const returnTo = safeReturnTo(sp.return_to);
  const backHref =
    returnTo ?? (sp.project ? `/projects/${sp.project}?tab=ventas` : sp.quotation ? `/quotations/${sp.quotation}` : "/payments?tab=anticipos");
  const backLabel = sp.project ? "el proyecto" : sp.quotation ? "la cotización" : "Cobros y pagos";

  const [clients, targets, bankAccounts, funds, fxContext] = await Promise.all([
    listActiveClients(),
    listAdvanceTargets(),
    listBankAccounts(),
    getAccountFunds(),
    getFxContext(),
  ]);
  const currencies = await listCurrencyOptions(fxContext.functionalCurrency);

  const initialTarget = sp.project ? `project:${sp.project}` : sp.quotation ? `quotation:${sp.quotation}` : "";
  const fromTarget = targets.find((t) => t.value === initialTarget);
  const initialClientId = fromTarget?.clientId ?? (sp.client && clients.some((c) => c.id === sp.client) ? sp.client : "");

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link href={backHref} className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text">
        <ArrowLeft size={14} /> Volver a {backLabel}
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Registrar anticipo</h1>
        <p className="text-sm text-brand-muted">
          Dinero que el cliente entrega <strong>antes</strong> de que exista la factura (ej. el 50 % para separar la
          fecha). Se le da un recibo de anticipo y luego se descuenta de la factura final.
        </p>
      </div>

      <Callout
        icon={<HandCoins size={18} />}
        title="¿Anticipo o cobro?"
        description="Si la factura ya existe, lo que pague el cliente es un cobro: regístralo en la factura con «Registrar cobro». El anticipo es solo para dinero recibido antes de facturar."
      />

      {!canCreate ? (
        <Card>
          <p className="text-sm text-brand-muted">
            Tu rol no puede registrar anticipos. Pídeselo a alguien de Finanzas o a un Administrador.
          </p>
        </Card>
      ) : bankAccounts.length === 0 ? (
        <Card>
          <p className="text-sm text-brand-muted">
            Primero crea una{" "}
            <Link href="/banks/new" className="text-brand-accent hover:underline">
              cuenta bancaria
            </Link>
            : el dinero del anticipo tiene que quedar en una cuenta.
          </p>
        </Card>
      ) : (
        <Card>
          <NewAdvanceForm
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            targets={targets}
            initialClientId={initialClientId}
            initialTarget={fromTarget ? initialTarget : ""}
            currencies={currencies}
            bankAccounts={bankAccounts}
            funds={funds}
            fxContext={fxContext}
            backHref={backHref}
            backLabel={backLabel}
          />
        </Card>
      )}
    </main>
  );
}
