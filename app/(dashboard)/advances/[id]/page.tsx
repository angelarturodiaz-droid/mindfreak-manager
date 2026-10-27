import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, FileText, FolderKanban, HandCoins, Landmark, UserRound } from "lucide-react";
import { hasPermission } from "@/lib/auth/permissions";
import {
  advanceTargetOf,
  getAdvance,
  listAdvanceMovements,
  listInvoicesForAdvance,
  listTransferOptions,
  type AdvanceMovementRow,
} from "@/features/advances/queries";
import {
  ADVANCE_STATUS_INFO,
  ADVANCE_STATUS_LABELS,
  ADVANCE_STATUS_TONES,
  MOVEMENT_KIND_LABELS,
  advanceStatus,
} from "@/features/advances/schema";
import { listBankAccounts } from "@/features/payments/queries";
import { getAccountFunds } from "@/features/banks/queries";
import { PAYMENT_METHOD_LABELS } from "@/features/payments/schema";
import { relationName, relationRow } from "@/lib/utils/relation";
import { formatDate } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { Card } from "@/components/ui/card";
import { Callout, Chip, MetricCard, SectionHeader } from "@/components/ui/page-kit";
import { InfoHint } from "@/components/ui/info-hint";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FoldableSection } from "@/components/ui/foldable-section";
import { AdvanceReceiptButton } from "@/components/advances/advance-receipt-button";
import { VoidApplicationButton } from "@/components/advances/void-application-button";
import { RefundAdvanceForm } from "@/components/advances/refund-advance-form";
import { TransferAdvanceForm } from "@/components/advances/transfer-advance-form";

/** Detalle de un anticipo: recibo, cuánto queda, historial y acciones. */
export default async function AdvanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuevo?: string }>;
}) {
  const { id } = await params;
  const { nuevo } = await searchParams;
  const advance = await getAdvance(id).catch(() => null);
  if (!advance) notFound();

  const [movements, invoices, canVoid, canPay] = await Promise.all([
    listAdvanceMovements(id),
    listInvoicesForAdvance(advance),
    hasPermission("payments.void"),
    hasPermission("payments.create"),
  ]);
  const available = Number(advance.available_amount);
  const canAct = canVoid && available > 0.005;
  const canTransfer = canAct && Number(advance.applied_amount) <= 0.005;
  const [bankAccounts, funds, transferOptions] = canAct
    ? await Promise.all([listBankAccounts(), getAccountFunds(), canTransfer ? listTransferOptions(advance) : Promise.resolve([])])
    : [[], {}, []];

  const cur = advance.currency;
  const status = advanceStatus(advance);
  const target = advanceTargetOf(advance);
  const clientName = relationName(advance.clients) ?? "Cliente";
  const bank = relationRow<{ name: string; bank_name: string | null }>(advance.bank_accounts);
  const backHref = target.href ?? "/payments?tab=anticipos";

  const movementColumns: Column<AdvanceMovementRow>[] = [
    { header: "Fecha", accessor: (m) => <span className="whitespace-nowrap text-brand-muted">{formatDate(m.movement_date)}</span> },
    {
      header: "Qué pasó",
      accessor: (m) => (
        <span className={m.status === "VOIDED" ? "text-brand-muted line-through" : "text-brand-text"}>
          {MOVEMENT_KIND_LABELS[m.kind] ?? m.kind}
        </span>
      ),
    },
    {
      header: "Detalle",
      accessor: (m) => {
        if (m.kind === "APPLY") {
          const n = relationRow<{ number: string }>(m.invoices)?.number ?? "factura";
          return (
            <span className="text-sm">
              <Link href={`/invoices/${m.invoice_id}`} className="text-brand-accent hover:underline">
                {n}
              </Link>
              {m.status === "VOIDED" && (
                <span className="block text-xs text-brand-muted">Quitado: {m.void_reason ?? "—"}</span>
              )}
            </span>
          );
        }
        if (m.kind === "REFUND") {
          const acc = relationRow<{ name: string; currency: string }>(m.bank_accounts);
          return (
            <span className="text-sm text-brand-muted">
              Salió de {acc?.name ?? "la cuenta"}
              {acc && acc.currency !== cur && m.account_amount ? ` (${formatMoney(Number(m.account_amount), acc.currency)})` : ""}
              {m.reason ? ` · ${m.reason}` : ""}
            </span>
          );
        }
        return (
          <span className="text-sm text-brand-muted">
            De {m.fromLabel} → a {m.toLabel}
            {m.reason ? ` · ${m.reason}` : ""}
          </span>
        );
      },
    },
    {
      header: "Monto",
      className: "text-right",
      accessor: (m) =>
        m.amount !== null ? (
          <span className={`whitespace-nowrap tabular-nums ${m.status === "VOIDED" ? "text-brand-muted line-through" : "text-brand-text"}`}>
            {formatMoney(Number(m.amount), cur)}
          </span>
        ) : (
          <span className="text-brand-muted">—</span>
        ),
    },
    {
      header: "",
      className: "text-right",
      accessor: (m) =>
        m.kind === "APPLY" && m.status === "ACTIVE" && canVoid ? (
          <VoidApplicationButton
            movementId={m.id}
            amount={Number(m.amount)}
            currency={cur}
            advanceNumber={advance.number}
            invoiceNumber={relationRow<{ number: string }>(m.invoices)?.number ?? "la factura"}
          />
        ) : null,
    },
  ];

  const nextStep =
    available > 0.005
      ? invoices.length > 0
        ? `ya hay ${invoices.length === 1 ? "una factura abierta" : `${invoices.length} facturas abiertas`} donde aplicarlo (abajo). Ábrela y pulsa «Aplicar anticipos».`
        : "cuando emitas la factura final, ábrela y pulsa «Aplicar anticipos». Mientras tanto, el dinero queda guardado aquí."
      : "este anticipo ya se usó completo. No hay nada pendiente.";

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link href={backHref} className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text">
        <ArrowLeft size={14} /> Volver a {target.kind === "client" ? "Cobros y pagos" : target.label}
      </Link>

      {nuevo === "1" && (
        <Callout
          icon={<CheckCircle2 size={18} />}
          title={`Anticipo ${advance.number} registrado`}
          description="Descarga el recibo y envíaselo al cliente. Cuando emitas la factura final, ábrela y pulsa «Aplicar anticipos» para descontarlo."
        >
          <AdvanceReceiptButton advanceId={advance.id} variant="button" label="Descargar recibo de anticipo" />
        </Callout>
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-[var(--radius-md)] bg-brand-accent-light px-2 py-0.5 text-sm font-semibold text-brand-accent">
                Recibo de anticipo
              </span>
              <h1 className="text-xl font-semibold text-brand-primary">{advance.number}</h1>
              <Chip tone={ADVANCE_STATUS_TONES[status]}>{ADVANCE_STATUS_LABELS[status]}</Chip>
              <InfoHint text={ADVANCE_STATUS_INFO[status]} />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-brand-text">
              <Link href={`/clients/${advance.client_id}`} className="inline-flex items-center gap-1.5 hover:text-brand-accent">
                <UserRound size={14} className="text-brand-muted" /> {clientName}
              </Link>
              <span className="inline-flex items-center gap-1.5">
                {target.kind === "project" ? (
                  <FolderKanban size={14} className="text-brand-muted" />
                ) : (
                  <FileText size={14} className="text-brand-muted" />
                )}
                {target.href ? (
                  <Link href={target.href} className="text-brand-accent hover:underline" title={target.detail}>
                    {target.label}
                  </Link>
                ) : (
                  <span title={target.detail}>{target.label}</span>
                )}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} className="text-brand-muted" /> Recibido {formatDate(advance.receipt_date)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Landmark size={14} className="text-brand-muted" />
                {advance.before_cutoff ? "Antes del corte (ya en el saldo inicial)" : (bank?.name ?? "—")}
              </span>
            </div>
          </div>
          <AdvanceReceiptButton advanceId={advance.id} />
        </div>
        <div className="mt-4 rounded-[var(--radius-md)] border border-brand-accent/25 bg-brand-accent-light px-3 py-2 text-sm text-brand-text">
          <ArrowRight size={14} className="mr-1 inline text-brand-accent" aria-hidden />
          <strong>Siguiente paso:</strong> {nextStep}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Recibido"
          value={formatMoney(Number(advance.amount), cur)}
          info="Lo que entregó el cliente como anticipo. No lleva impuestos y todavía no es venta."
          hint={advance.method ? PAYMENT_METHOD_LABELS[advance.method] ?? advance.method : undefined}
        />
        <MetricCard
          label="Aplicado a facturas"
          value={formatMoney(Number(advance.applied_amount), cur)}
          info="Lo que ya se descontó de la factura final. Desde ese momento cuenta como cobrado de esa factura."
          tone={Number(advance.applied_amount) > 0 ? "success" : undefined}
        />
        <MetricCard
          label="Devuelto"
          value={formatMoney(Number(advance.refunded_amount), cur)}
          info="Lo que se le devolvió al cliente (por ejemplo, si canceló el evento). Salió del banco."
        />
        <MetricCard
          label="Disponible"
          value={formatMoney(available, cur)}
          info="Lo que queda para descontar de la factura final (o para devolver)."
          tone={available > 0 ? "warning" : undefined}
          pct={Number(advance.amount) > 0 ? ((Number(advance.amount) - available) / Number(advance.amount)) * 100 : null}
          hint={`${Math.round(Number(advance.amount) > 0 ? ((Number(advance.amount) - available) / Number(advance.amount)) * 100 : 0)} % usado`}
        />
      </div>

      {available > 0.005 && invoices.length > 0 && (
        <section>
          <SectionHeader
            title="Facturas donde puedes aplicarlo"
            count={invoices.length}
            description="Facturas abiertas de este cliente, en la misma moneda y del mismo proyecto o cotización."
          />
          <ul className="flex flex-col gap-2">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/invoices/${inv.id}#aplicar-anticipos`}
                  className="flex items-center justify-between rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-4 py-2.5 text-sm hover:bg-brand-surface-hover"
                >
                  <span className="font-medium text-brand-accent">{inv.number}</span>
                  <span className="text-brand-muted">
                    Debe {formatMoney(Number(inv.balance), inv.currency)} · <span className="text-brand-accent">Abrir y aplicar →</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionHeader
          title="Historial"
          count={movements.length}
          description="Todo lo que ha pasado con este anticipo: aplicaciones a facturas, devoluciones y traspasos."
        />
        <DataTable
          columns={movementColumns}
          rows={movements}
          keyFor={(m) => m.id}
          maxWidth="max-w-none"
          emptyMessage="Todavía no se ha usado: está completo y disponible."
        />
      </section>

      {(advance.reference || advance.notes || advance.bank_fee_amount) && (
        <Card>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            {advance.reference && (
              <div>
                <dt className="text-xs text-brand-muted">Referencia</dt>
                <dd className="text-brand-text">{advance.reference}</dd>
              </div>
            )}
            {advance.bank_fee_amount && (
              <div>
                <dt className="text-xs text-brand-muted">Comisión del banco</dt>
                <dd className="text-brand-text">{formatMoney(Number(advance.bank_fee_amount), advance.account_currency ?? cur)}</dd>
              </div>
            )}
            {advance.notes && (
              <div className="sm:col-span-3">
                <dt className="text-xs text-brand-muted">Nota</dt>
                <dd className="text-brand-text">{advance.notes}</dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      {canAct && (
        <div className="flex flex-col gap-4">
          <FoldableSection
            storageKey="anticipo.devolver"
            title="Devolver al cliente"
            icon={<HandCoins size={16} />}
            defaultOpen={false}
            info="Si el evento se cancela y se le devuelve el dinero al cliente. Sale del banco con la categoría «Devolución a cliente». Puede ser solo una parte."
            description="El dinero sale de la cuenta que elijas. Pide el motivo y queda en la Auditoría."
          >
            <RefundAdvanceForm advanceId={advance.id} available={available} currency={cur} bankAccounts={bankAccounts} funds={funds} />
          </FoldableSection>
          {canTransfer ? (
            <FoldableSection
              storageKey="anticipo.pasar"
              title="Pasar a otro proyecto o cotización"
              icon={<ArrowRight size={16} />}
              defaultOpen={false}
              info="Si el cliente cambia el evento (otra fecha u otro proyecto), el anticipo se pasa sin mover dinero. Solo del mismo cliente."
              description="No mueve dinero. Queda anotado en el historial de los dos."
            >
              {transferOptions.length > 0 ? (
                <TransferAdvanceForm advanceId={advance.id} options={transferOptions} />
              ) : (
                <p className="text-sm text-brand-muted">
                  Este cliente no tiene otro proyecto o cotización aprobada en {cur} a donde pasarlo.
                </p>
              )}
            </FoldableSection>
          ) : (
            <p className="text-xs text-brand-muted">
              Una parte ya se aplicó a una factura, por eso no se puede pasar a otro proyecto. Si se aplicó por error,
              usa «Quitar» en el historial.
            </p>
          )}
        </div>
      )}
      {!canVoid && available > 0.005 && (
        <p className="text-xs text-brand-muted">
          Devolver o pasar a otro proyecto lo hacen Administración o Finanzas.
          {canPay ? " Aplicarlo a la factura sí lo puedes hacer tú, desde la factura." : ""}
        </p>
      )}
    </main>
  );
}
