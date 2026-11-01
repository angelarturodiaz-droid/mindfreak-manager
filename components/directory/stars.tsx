import { Star } from "lucide-react";

/** Calificación de 1 a 5 estrellas (solo mostrar). */
export function Stars({ value, size = 13 }: { value: number | null; size?: number }) {
  if (!value) return <span className="text-xs text-brand-muted">Sin calificar</span>;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} de 5 estrellas`} title={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= value ? "fill-amber-400 text-amber-400" : "text-brand-border"} aria-hidden />
      ))}
    </span>
  );
}
