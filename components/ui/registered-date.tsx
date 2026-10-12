import { formatDate, formatRegistered } from "@/lib/utils/dates";

/**
 * Fecha de un movimiento (la que se escribió en el formulario) y, debajo y
 * más pequeño, cuándo se registró en el sistema (fecha y hora de República
 * Dominicana). La hora real del banco no se conoce.
 */
export function RegisteredDate({
  date,
  createdAt,
  className = "text-brand-muted",
}: {
  date: string | null | undefined;
  createdAt?: string | null;
  className?: string;
}) {
  return (
    <span className="flex flex-col whitespace-nowrap">
      <span className={className}>{formatDate(date)}</span>
      {createdAt && (
        <span className="text-[11px] text-brand-muted/80" title="Fecha y hora en que se registró en el sistema">
          Registrado {formatRegistered(createdAt)}
        </span>
      )}
    </span>
  );
}
