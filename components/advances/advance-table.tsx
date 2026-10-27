import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Chip, InitialsAvatar } from "@/components/ui/page-kit";
import { InfoHint } from "@/components/ui/info-hint";
import { formatMoney } from "@/lib/utils/money";
import { formatDate } from "@/lib/utils/dates";
import { relationName } from "@/lib/utils/relation";
import { advanceTargetOf, type AdvanceRow } from "@/features/advances/queries";
import {
  ADVANCE_STATUS_INFO,
  ADVANCE_STATUS_LABELS,
  ADVANCE_STATUS_TONES,
  advanceStatus,
} from "@/features/advances/schema";

/**
 * Tabla de anticipos (proyecto, cotización y Cobros y pagos). Cada número
 * abre el anticipo, donde están el recibo y las acciones.
 */
export function AdvanceTable({
  rows,
  showClient = false,
  showTarget = true,
  emptyMessage = "No hay anticipos registrados.",
}: {
  rows: AdvanceRow[];
  showClient?: boolean;
  showTarget?: boolean;
  emptyMessage?: string;
}) {
  const columns: Column<AdvanceRow>[] = [
    {
      header: "Anticipo",
      info: "Número del recibo de anticipo (ANT). Haz clic para verlo, descargar el recibo, devolverlo o pasarlo a otro proyecto.",
      accessor: (a) => (
        <Link href={`/advances/${a.id}`} className="font-semibold text-brand-accent hover:underline">
          {a.number}
        </Link>
      ),
    },
    { header: "Fecha", accessor: (a) => <span className="whitespace-nowrap text-brand-muted">{formatDate(a.receipt_date)}</span> },
    ...(showClient
      ? [
          {
            header: "Cliente",
            accessor: (a: AdvanceRow) => {
              const name = relationName(a.clients) ?? "—";
              return (
                <span className="flex items-center gap-2">
                  <InitialsAvatar name={name} size="sm" />
                  <span className="text-brand-text">{name}</span>
                </span>
              );
            },
          } satisfies Column<AdvanceRow>,
        ]
      : []),
    ...(showTarget
      ? [
          {
            header: "Para",
            info: "A qué va ligado: un proyecto, una cotización aprobada o «solo el cliente» (se puede aplicar a cualquier factura suya en la misma moneda).",
            accessor: (a: AdvanceRow) => {
              const t = advanceTargetOf(a);
              return t.href ? (
                <Link href={t.href} className="whitespace-nowrap text-brand-accent hover:underline" title={t.detail}>
                  {t.label}
                </Link>
              ) : (
                <span className="whitespace-nowrap text-brand-muted" title={t.detail}>
                  {t.label}
                </span>
              );
            },
          } satisfies Column<AdvanceRow>,
        ]
      : []),
    {
      header: "Recibido",
      className: "text-right",
      info: "Lo que entregó el cliente como anticipo.",
      accessor: (a) => (
        <span className="whitespace-nowrap tabular-nums text-brand-text">
          {formatMoney(Number(a.amount), a.currency)}
          {a.before_cutoff && (
            <span className="block text-[11px] text-brand-muted" title="Recibido antes del cambio de sistema: ya está en el saldo inicial del banco.">
              antes del corte
            </span>
          )}
        </span>
      ),
    },
    {
      header: "Usado",
      className: "text-right",
      info: "Lo que ya se descontó de una factura (aplicado) o se le devolvió al cliente.",
      accessor: (a) => {
        const used = Number(a.applied_amount) + Number(a.refunded_amount);
        return used > 0 ? (
          <span className="whitespace-nowrap tabular-nums text-brand-muted">{formatMoney(used, a.currency)}</span>
        ) : (
          <span className="text-brand-muted">—</span>
        );
      },
    },
    {
      header: "Disponible",
      className: "text-right",
      info: "Lo que todavía se puede descontar de la factura final (o devolver).",
      accessor: (a) => (
        <span
          className={`whitespace-nowrap font-semibold tabular-nums ${
            Number(a.available_amount) > 0 ? "text-brand-accent" : "text-brand-muted"
          }`}
        >
          {formatMoney(Number(a.available_amount), a.currency)}
        </span>
      ),
    },
    {
      header: "Estado",
      accessor: (a) => {
        const s = advanceStatus(a);
        return (
          <span className="inline-flex items-center gap-1">
            <Chip tone={ADVANCE_STATUS_TONES[s]}>{ADVANCE_STATUS_LABELS[s]}</Chip>
            <InfoHint text={ADVANCE_STATUS_INFO[s]} />
          </span>
        );
      },
    },
  ];
  return <DataTable columns={columns} rows={rows} keyFor={(a) => a.id} maxWidth="max-w-none" emptyMessage={emptyMessage} />;
}
