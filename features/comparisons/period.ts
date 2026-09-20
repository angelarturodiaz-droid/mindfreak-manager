/**
 * Cálculo de períodos para la sección de Comparaciones — todo en fechas
 * UTC "civiles" (sin hora), porque las columnas que se filtran
 * (issue_date, expense_date, payment_date) son `date`, no `timestamptz`.
 * Usar UTC evita que el período cambie de día según la hora del server.
 */

export type PeriodKey =
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "last_year"
  | "custom";

export type Period = {
  key: PeriodKey;
  label: string;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  prevLabel: string;
};

const MONTH_LABELS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function addDaysUTC(d: Date, days: number) {
  const nd = new Date(d.getTime());
  nd.setUTCDate(nd.getUTCDate() + days);
  return nd;
}

function startOfMonthUTC(y: number, m: number) {
  return new Date(Date.UTC(y, m, 1));
}
function endOfMonthUTC(y: number, m: number) {
  return new Date(Date.UTC(y, m + 1, 0));
}
function startOfQuarterUTC(y: number, q: number) {
  return new Date(Date.UTC(y, q * 3, 1));
}
function endOfQuarterUTC(y: number, q: number) {
  return new Date(Date.UTC(y, q * 3 + 3, 0));
}
function startOfYearUTC(y: number) {
  return new Date(Date.UTC(y, 0, 1));
}
function endOfYearUTC(y: number) {
  return new Date(Date.UTC(y, 11, 31));
}

function build(key: PeriodKey, label: string, from: Date, to: Date, prevFrom: Date, prevTo: Date, prevLabel: string): Period {
  return {
    key,
    label,
    from: toISODate(from),
    to: toISODate(to),
    prevFrom: toISODate(prevFrom),
    prevTo: toISODate(prevTo),
    prevLabel,
  };
}

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "this_month", label: "Este mes" },
  { key: "last_month", label: "Mes anterior" },
  { key: "this_quarter", label: "Este trimestre" },
  { key: "last_quarter", label: "Trimestre anterior" },
  { key: "this_year", label: "Este año" },
  { key: "last_year", label: "Año anterior" },
  { key: "custom", label: "Personalizado" },
];

export function resolvePeriod(params: { period?: string; from?: string; to?: string }): Period {
  const key = (PERIOD_OPTIONS.some((o) => o.key === params.period) ? params.period : "this_month") as PeriodKey;

  if (key === "custom" && params.from && params.to) {
    const fromD = new Date(`${params.from}T00:00:00Z`);
    const toD = new Date(`${params.to}T00:00:00Z`);
    if (!Number.isNaN(fromD.getTime()) && !Number.isNaN(toD.getTime()) && fromD <= toD) {
      const lengthDays = Math.round((toD.getTime() - fromD.getTime()) / 86400000) + 1;
      const prevTo = addDaysUTC(fromD, -1);
      const prevFrom = addDaysUTC(prevTo, -(lengthDays - 1));
      return build(
        key,
        `${params.from} — ${params.to}`,
        fromD,
        toD,
        prevFrom,
        prevTo,
        `${toISODate(prevFrom)} — ${toISODate(prevTo)}`,
      );
    }
  }

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();

  switch (key) {
    case "last_month": {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      const pm = lm === 0 ? 11 : lm - 1;
      const py = lm === 0 ? ly - 1 : ly;
      return build(
        key,
        `${MONTH_LABELS[lm]} ${ly}`,
        startOfMonthUTC(ly, lm),
        endOfMonthUTC(ly, lm),
        startOfMonthUTC(py, pm),
        endOfMonthUTC(py, pm),
        `${MONTH_LABELS[pm]} ${py}`,
      );
    }
    case "this_quarter": {
      const q = Math.floor(m / 3);
      const pq = q === 0 ? 3 : q - 1;
      const py = q === 0 ? y - 1 : y;
      return build(
        key,
        `T${q + 1} ${y}`,
        startOfQuarterUTC(y, q),
        endOfQuarterUTC(y, q),
        startOfQuarterUTC(py, pq),
        endOfQuarterUTC(py, pq),
        `T${pq + 1} ${py}`,
      );
    }
    case "last_quarter": {
      const currentQ = Math.floor(m / 3);
      const q = currentQ === 0 ? 3 : currentQ - 1;
      const qy = currentQ === 0 ? y - 1 : y;
      const pq = q === 0 ? 3 : q - 1;
      const py = q === 0 ? qy - 1 : qy;
      return build(
        key,
        `T${q + 1} ${qy}`,
        startOfQuarterUTC(qy, q),
        endOfQuarterUTC(qy, q),
        startOfQuarterUTC(py, pq),
        endOfQuarterUTC(py, pq),
        `T${pq + 1} ${py}`,
      );
    }
    case "this_year":
      return build(key, `${y}`, startOfYearUTC(y), endOfYearUTC(y), startOfYearUTC(y - 1), endOfYearUTC(y - 1), `${y - 1}`);
    case "last_year":
      return build(
        key,
        `${y - 1}`,
        startOfYearUTC(y - 1),
        endOfYearUTC(y - 1),
        startOfYearUTC(y - 2),
        endOfYearUTC(y - 2),
        `${y - 2}`,
      );
    case "this_month":
    default: {
      const pm = m === 0 ? 11 : m - 1;
      const py = m === 0 ? y - 1 : y;
      return build(
        "this_month",
        `${MONTH_LABELS[m]} ${y}`,
        startOfMonthUTC(y, m),
        endOfMonthUTC(y, m),
        startOfMonthUTC(py, pm),
        endOfMonthUTC(py, pm),
        `${MONTH_LABELS[pm]} ${py}`,
      );
    }
  }
}

/** % de cambio de `previous` a `current`. `null` si no se puede calcular (base 0). */
export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
