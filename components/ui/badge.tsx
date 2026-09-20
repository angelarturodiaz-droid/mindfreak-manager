export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: "bg-brand-success-bg text-brand-success",
  warning: "bg-brand-warning-bg text-brand-warning",
  danger: "bg-brand-danger-bg text-brand-danger",
  info: "bg-brand-info-bg text-brand-info",
  neutral: "bg-brand-surface-hover text-brand-muted",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  success: "bg-brand-success",
  warning: "bg-brand-warning",
  danger: "bg-brand-danger",
  info: "bg-brand-info",
  neutral: "bg-brand-muted",
};

/**
 * Mapeo por defecto de estados de negocio → tono del badge. Cubre los
 * estados usados en cotizaciones, facturas, proyectos, gastos, pagos.
 * Cualquier estado no mapeado cae en "neutral".
 */
const STATUS_TONE: Record<string, BadgeTone> = {
  // positivos / completado
  PAID: "success",
  PAGADO: "success",
  APPROVED: "success",
  COMPLETED: "success",
  ACTIVE: "success",
  CONFIRMED: "success",
  RECONCILE: "success",
  // en proceso / pendiente
  PENDING: "warning",
  DRAFT: "warning",
  PARTIALLY_PAID: "warning",
  IN_PROGRESS: "warning",
  SENT: "warning",
  NEGOTIATING: "warning",
  PLANNING: "warning",
  // negativos / vencido / cancelado
  OVERDUE: "danger",
  CANCELLED: "danger",
  REJECTED: "danger",
  EXPIRED: "danger",
  // informativo
  ISSUED: "info",
  VIEWED: "info",
};

export function Badge({
  tone,
  status,
  children,
}: {
  tone?: BadgeTone;
  status?: string;
  children: React.ReactNode;
}) {
  const resolvedTone = tone ?? (status ? STATUS_TONE[status] ?? "neutral" : "neutral");
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[resolvedTone]}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[resolvedTone]}`} aria-hidden="true" />
      {children}
    </span>
  );
}
