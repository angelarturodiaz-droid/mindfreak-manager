import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

/**
 * Píldora de variación % — verde/rojo según si el cambio es "bueno" o
 * no para esa métrica en particular (para gastos, que bajen es bueno,
 * así que se invierte con `positiveIsGood={false}`).
 */
export function DeltaPill({
  pct,
  positiveIsGood = true,
}: {
  pct: number | null;
  positiveIsGood?: boolean;
}) {
  if (pct === null) {
    return <span className="text-xs text-brand-muted">— sin base</span>;
  }
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-surface-hover px-2 py-0.5 text-xs font-medium text-brand-muted">
        <Minus size={12} /> 0.0%
      </span>
    );
  }
  const isPositive = pct > 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        isGood ? "bg-brand-success-bg text-brand-success" : "bg-brand-danger-bg text-brand-danger"
      }`}
    >
      {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {isPositive ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}
