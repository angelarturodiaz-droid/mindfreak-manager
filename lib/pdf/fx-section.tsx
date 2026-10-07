import { Text, View, StyleSheet } from "@react-pdf/renderer";

/**
 * Multimoneda V5 (paso 5): datos de conversión que guardan los pagos y
 * cobros (migraciones 076 y 077). Todos opcionales: los registros
 * anteriores no los tienen y el recibo se ve igual que antes.
 */
export type PaymentFxData = {
  account_currency?: string | null;
  account_amount?: number | null;
  bank_fee_amount?: number | null;
  effective_rate?: number | null;
  effective_rate_currency?: string | null;
  reference_rate?: number | null;
  reference_rate_document?: number | null;
  rounding_difference?: number | null;
  informative_difference?: number | null;
  functional_currency?: string | null;
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(amount);
}
const rate = (n: number) =>
  new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(n);

/**
 * Filas de la sección "Conversión de moneda" del recibo. Vacía si el pago
 * fue en la misma moneda y sin comisión (el recibo queda como antes).
 */
export function fxSectionRows(
  kind: "COBRO" | "PAGO",
  documentLabel: string,
  documentCurrency: string,
  applied: number,
  fx: PaymentFxData,
): { label: string; value: string; note?: boolean }[] {
  const accCur = fx.account_currency || documentCurrency;
  const foreign = accCur !== documentCurrency;
  const fee = Number(fx.bank_fee_amount ?? 0);
  if (!foreign && !(fee > 0)) return [];

  const bank = Number(fx.account_amount ?? applied);
  const rows: { label: string; value: string; note?: boolean }[] = [
    { label: `Aplicado ${documentLabel}`, value: money(applied, documentCurrency) },
    {
      label: kind === "COBRO" ? "Entró a la cuenta" : "Salió de la cuenta",
      value: money(bank, accCur),
    },
  ];
  if (fee > 0) {
    rows.push({ label: "Comisión del banco (registrada aparte)", value: money(fee, accCur) });
    rows.push({
      label: kind === "COBRO" ? "Neto en la cuenta" : "Débito total",
      value: money(Math.round((kind === "COBRO" ? bank - fee : bank + fee) * 100) / 100, accCur),
    });
  }
  const fn = fx.functional_currency || "DOP";
  if (foreign && fx.effective_rate && fx.effective_rate_currency) {
    rows.push({ label: "Tasa efectiva", value: `1 ${fx.effective_rate_currency} = ${rate(Number(fx.effective_rate))} ${fn}` });
  }
  // La tasa de referencia que se compara es la de la moneda que describe la tasa efectiva.
  const ref = accCur !== fn ? fx.reference_rate : fx.reference_rate_document;
  if (foreign && ref && fx.effective_rate_currency) {
    rows.push({ label: "Tasa de referencia del día", value: `1 ${fx.effective_rate_currency} = ${rate(Number(ref))} ${fn}` });
  }
  const rounding = Number(fx.rounding_difference ?? 0);
  const diff = Number(fx.informative_difference ?? 0);
  if (foreign && rounding !== 0) rows.push({ label: "Redondeo", value: money(rounding, fn) });
  if (foreign && diff !== 0) {
    rows.push({ label: "Diferencia informativa (no contable)", value: money(diff, fn) });
  }
  if (foreign) {
    rows.push({
      label: `El documento se mantiene en ${documentCurrency}; la cuenta se movió solo en ${accCur}. La diferencia informativa no es una ganancia ni una pérdida contable.`,
      value: "",
      note: true,
    });
  }
  return rows;
}

export function PdfFxSection({
  title,
  rows,
  accent,
  background,
}: {
  title: string;
  rows: { label: string; value: string; note?: boolean }[];
  accent: string;
  background: string;
}) {
  if (rows.length === 0) return null;
  const styles = StyleSheet.create({
    title: { color: accent, fontSize: 9, fontWeight: 700, marginTop: 14, marginBottom: 6, letterSpacing: 0.5 },
    box: { backgroundColor: background, paddingHorizontal: 12, paddingVertical: 8 },
    row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
    label: { fontSize: 8, color: "#374151" },
    value: { fontSize: 8, fontWeight: 700, color: "#1a1a1a" },
    note: { fontSize: 7, color: "#6b7280", marginTop: 3 },
  });
  return (
    <View wrap={false}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.box}>
        {rows.map((r) =>
          r.note ? (
            <Text key={r.label} style={styles.note}>
              {r.label}
            </Text>
          ) : (
            <View key={r.label} style={styles.row}>
              <Text style={styles.label}>{r.label}</Text>
              <Text style={styles.value}>{r.value}</Text>
            </View>
          ),
        )}
      </View>
    </View>
  );
}
