import { formatDate, formatRegistered, formatTime, localDateOf } from "@/lib/utils/dates";

/**
 * Fecha de un movimiento (la que se escribió en el formulario) con la hora
 * en que se registró en el sistema, sin repetir la fecha:
 * - registrado el mismo día → una sola línea: "11 oct 2026 · 8:30 p. m.";
 * - registrado otro día (con atraso) → la fecha y, debajo, "Registrado
 *   13 oct, 9:15 a. m." para que se note que se anotó después.
 * La hora real del banco no se conoce.
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
  if (!createdAt || !date) return <span className={`whitespace-nowrap ${className}`}>{formatDate(date)}</span>;
  const sameDay = localDateOf(createdAt) === date.slice(0, 10);
  if (sameDay) {
    return (
      <span className={`whitespace-nowrap ${className}`} title="Hora en que se registró en el sistema">
        {formatDate(date)} <span className="text-brand-muted">· {formatTime(createdAt)}</span>
      </span>
    );
  }
  return (
    <span className="flex flex-col whitespace-nowrap">
      <span className={className}>{formatDate(date)}</span>
      <span className="text-[11px] text-brand-muted/80" title="Se registró en el sistema en otra fecha">
        Registrado {formatRegistered(createdAt)}
      </span>
    </span>
  );
}
