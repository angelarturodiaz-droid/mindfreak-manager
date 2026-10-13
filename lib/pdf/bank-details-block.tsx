import { Text, View, StyleSheet } from "@react-pdf/renderer";
import type { BankDetail } from "@/features/banks/bank-details";

const CURRENCY_NAMES: Record<string, string> = {
  DOP: "Pesos dominicanos (DOP)",
  USD: "Dólares (USD)",
  EUR: "Euros (EUR)",
};

/**
 * Recuadro "Datos bancarios para el pago" de facturas y cotizaciones
 * (migración 082). Usa la copia congelada guardada en el documento; si no
 * hay cuentas elegidas no se dibuja nada.
 */
export function BankDetailsBlock({
  details,
  accent,
  dark,
}: {
  details: BankDetail[] | null | undefined;
  accent: string;
  dark: string;
}) {
  if (!details || details.length === 0) return null;

  const styles = StyleSheet.create({
    wrap: { marginTop: 14 },
    title: {
      fontSize: 8,
      fontWeight: 700,
      color: accent,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    box: {
      width: details.length === 1 ? "60%" : "48.5%",
      borderWidth: 1,
      borderColor: "#d1d5db",
      borderRadius: 4,
      padding: 7,
    },
    bank: { fontSize: 9, fontWeight: 700, color: dark, marginBottom: 2 },
    line: { fontSize: 8.5, color: "#1a1a1a", marginBottom: 1 },
    label: { color: "#4b5563" },
  });

  return (
    <View style={styles.wrap} wrap={false}>
      <Text style={styles.title}>Datos bancarios para el pago</Text>
      <View style={styles.row}>
        {details.map((d) => (
          <View key={d.bank_account_id} style={styles.box}>
            <Text style={styles.bank}>{d.bank_name ?? d.account_name}</Text>
            {d.number && (
              <Text style={styles.line}>
                <Text style={styles.label}>Cuenta: </Text>
                {d.number}
                {d.kind_label ? ` (${d.kind_label})` : ""}
              </Text>
            )}
            <Text style={styles.line}>
              <Text style={styles.label}>Moneda: </Text>
              {CURRENCY_NAMES[d.currency] ?? d.currency}
            </Text>
            {d.holder && (
              <Text style={styles.line}>
                <Text style={styles.label}>Titular: </Text>
                {d.holder}
              </Text>
            )}
            {d.tax_id && (
              <Text style={styles.line}>
                <Text style={styles.label}>RNC: </Text>
                {d.tax_id}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
