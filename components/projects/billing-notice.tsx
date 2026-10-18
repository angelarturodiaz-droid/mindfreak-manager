import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { InfoHint } from "@/components/ui/info-hint";
import { formatMoney } from "@/lib/utils/money";
import type { BillingProgress } from "@/features/projects/billing-progress";

const HELP =
  "Compara lo que el cliente aprobó (cotizaciones Aprobadas del proyecto) con lo ya facturado (facturas emitidas; no cuenta borradores ni canceladas). Un proyecto puede tener varias facturas: anticipo, balance, adicionales. Es solo un aviso: no bloquea nada. Montos en pesos con la tasa de cada documento.";

/**
 * Aviso "Cotizado vs. facturado".
 * - `project`: en la pestaña Ventas del proyecto (incluye los borradores).
 * - `invoice`: en una factura en Borrador de un proyecto ("con esta factura…").
 */
export function BillingNotice({
  progress: p,
  context,
  projectLabel,
}: {
  progress: BillingProgress;
  context: "project" | "invoice";
  projectLabel?: string;
}) {
  if (p.state === "none") {
    if (context === "invoice") return null;
    return (
      <Box tone="muted" icon={<Info size={16} />}>
        <span>
          <strong>Cotizado vs. facturado:</strong> este proyecto no tiene una cotización <em>Aprobada</em>, así que no hay
          con qué comparar lo facturado ({formatMoney(p.facturado)}).
        </span>
      </Box>
    );
  }

  const bar = <Bar pct={p.pct ?? 0} tone={p.state === "over" ? "danger" : p.borradoresExceden ? "warning" : p.state === "complete" ? "success" : "info"} />;
  const resumen = (
    <span className="text-brand-muted">
      Cotizado {formatMoney(p.cotizado)} · Facturado {formatMoney(p.facturado)}
      {p.pct !== null && ` (${p.pct.toFixed(0)} %)`}
    </span>
  );

  if (context === "invoice") {
    // p.borradores = esta factura.
    const conEsta = p.facturado + p.borradores;
    const falta = p.cotizado - conEsta;
    const tone = p.borradoresExceden || p.state === "over" ? "warning" : "info";
    return (
      <Box tone={tone} icon={tone === "warning" ? <AlertTriangle size={16} /> : <Info size={16} />}>
        <div className="flex flex-col gap-1">
          <span>
            <strong>{projectLabel ? `Proyecto ${projectLabel}: ` : "Proyecto: "}</strong>
            {p.borradoresExceden || p.state === "over" ? (
              <>
                con esta factura se facturarían <strong>{formatMoney(conEsta)}</strong>, que es{" "}
                <strong>{formatMoney(conEsta - p.cotizado)} más</strong> de lo cotizado ({formatMoney(p.cotizado)}). Revisa
                antes de emitir.
              </>
            ) : Math.abs(falta) < 1 ? (
              <>con esta factura queda <strong>facturado todo lo cotizado</strong> ({formatMoney(p.cotizado)}).</>
            ) : (
              <>
                con esta factura quedaría por facturar <strong>{formatMoney(falta)}</strong> de{" "}
                {formatMoney(p.cotizado)} cotizado.
              </>
            )}
            <InfoHint text={HELP} />
          </span>
          {resumen}
        </div>
      </Box>
    );
  }

  const tone = p.state === "over" ? "danger" : p.state === "complete" ? "success" : p.borradoresExceden ? "warning" : "info";
  const icon =
    p.state === "complete" ? <CheckCircle2 size={16} /> : tone === "info" ? <Info size={16} /> : <AlertTriangle size={16} />;
  return (
    <Box tone={tone} icon={icon}>
      <div className="flex w-full flex-col gap-1.5">
        <span>
          <strong>Cotizado vs. facturado: </strong>
          {p.state === "over" && (
            <>
              se facturó <strong>{formatMoney(-p.restante)} más</strong> de lo cotizado. Revisa si hay una factura de más
              o si falta aprobar una cotización por los adicionales.
            </>
          )}
          {p.state === "complete" && <>todo lo cotizado ya está facturado.</>}
          {p.state === "pending" && (
            <>
              falta por facturar <strong>{formatMoney(p.restante)}</strong>.
            </>
          )}
          {p.borradoresExceden && (
            <>
              {" "}
              Ojo: hay borradores por {formatMoney(p.borradores)}; si se emiten se pasaría por{" "}
              <strong>{formatMoney(p.excesoConBorradores)}</strong>.
            </>
          )}
          <InfoHint text={HELP} />
        </span>
        {bar}
        {resumen}
      </div>
    </Box>
  );
}

const TONES = {
  info: ["border-brand-accent/30 bg-brand-accent-light", "text-brand-accent"],
  success: ["border-brand-success/30 bg-brand-success-bg", "text-brand-success"],
  warning: ["border-brand-warning/40 bg-brand-warning-bg", "text-brand-warning"],
  danger: ["border-brand-danger/40 bg-brand-danger-bg", "text-brand-danger"],
  muted: ["border-brand-border bg-brand-surface", "text-brand-muted"],
} as const;

function Box({ tone, icon, children }: { tone: keyof typeof TONES; icon: React.ReactNode; children: React.ReactNode }) {
  const [box, iconColor] = TONES[tone];
  return (
    <div role="status" className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm text-brand-text ${box}`}>
      <span className={`mt-0.5 shrink-0 ${iconColor}`}>{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Bar({ pct, tone }: { pct: number; tone: "info" | "success" | "warning" | "danger" }) {
  const color = { info: "bg-brand-accent", success: "bg-brand-success", warning: "bg-brand-warning", danger: "bg-brand-danger" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-border" aria-hidden>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}
