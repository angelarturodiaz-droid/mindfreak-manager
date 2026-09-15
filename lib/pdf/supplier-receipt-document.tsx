import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

function tintWithWhite(hex: string, whiteFactor: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * whiteFactor);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  TRANSFER: "Transferencia",
  DEPOSIT: "Depósito",
  CHECK: "Cheque",
  CARD: "Tarjeta",
  CASH: "Efectivo",
  OTHER: "Otro",
};

export type SupplierReceiptPdfData = {
  company: {
    name: string;
    legal_name: string | null;
    tax_id: string | null;
    logo_url: string | null;
    brand_primary: string;
    brand_accent: string;
  };
  payment: {
    id: string;
    payment_date: string;
    amount: number;
    method: string;
    reference: string | null;
    currency: string;
    payee_bank_name: string | null;
  };
  expense: { description: string; balance: number };
  supplier: { name: string; tax_id: string | null; email: string | null; phone: string | null };
  bankAccount: { name: string; bank_name: string | null } | null;
};

export function SupplierReceiptPdfDocument({
  company,
  payment,
  expense,
  supplier,
  bankAccount,
}: SupplierReceiptPdfData) {
  const dark = company.brand_primary || "#0b0e14";
  const accent = company.brand_accent || "#17a6b8";
  const accentLight = tintWithWhite(accent, 0.9);
  const receiptNumber = `PAG-${payment.id.slice(0, 8).toUpperCase()}`;

  const styles = StyleSheet.create({
    page: { fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
    headerBar: {
      backgroundColor: dark,
      paddingHorizontal: 32,
      paddingVertical: 18,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    logoWrap: {
      width: 40,
      height: 40,
      backgroundColor: "#ffffff",
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
      padding: 4,
    },
    logo: { width: "100%", height: "100%", objectFit: "contain" },
    companyName: { color: "#ffffff", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 },
    docPill: {
      marginTop: 8,
      alignSelf: "flex-start",
      backgroundColor: accent,
      color: "#ffffff",
      fontSize: 9,
      fontWeight: 700,
      paddingHorizontal: 10,
      paddingVertical: 4,
      letterSpacing: 0.5,
    },
    docType: { color: accent, fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 1 },
    metaRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2, gap: 8 },
    metaLabel: { color: accent, fontSize: 8, fontWeight: 700, width: 70, textAlign: "right" },
    metaValue: { color: "#ffffff", fontSize: 8, width: 90, textAlign: "right" },
    body: { paddingHorizontal: 32, paddingTop: 20, paddingBottom: 40 },
    twoCol: { flexDirection: "row", gap: 24, marginBottom: 20 },
    col: { flex: 1 },
    sectionTitle: {
      color: accent,
      fontSize: 9,
      fontWeight: 700,
      marginBottom: 6,
      letterSpacing: 0.5,
    },
    fieldRow: { flexDirection: "row", marginBottom: 5 },
    fieldLabel: { width: 80, fontSize: 8, fontWeight: 700, color: "#374151" },
    fieldValue: {
      flex: 1,
      fontSize: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: "#d1d5db",
      paddingBottom: 2,
    },
    amountBox: {
      marginTop: 12,
      backgroundColor: accentLight,
      padding: 16,
      alignItems: "center",
    },
    amountLabel: { fontSize: 9, color: "#374151", marginBottom: 4, letterSpacing: 0.5 },
    amountValue: { fontSize: 22, fontWeight: 700, color: accent },
    grandTotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: accent,
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginTop: 18,
    },
    grandTotalLabel: { color: "#ffffff", fontSize: 10, fontWeight: 700 },
    grandTotalValue: { color: "#ffffff", fontSize: 10, fontWeight: 700 },
    footer: {
      position: "absolute",
      bottom: 24,
      left: 32,
      right: 32,
      fontSize: 7,
      color: "#9ca3af",
      textAlign: "center",
    },
  });

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerBar}>
          <View>
            {company.logo_url && (
              <View style={styles.logoWrap}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf/renderer, no HTML img */}
                <Image src={company.logo_url} style={styles.logo} />
              </View>
            )}
            <Text style={styles.companyName}>{company.name}</Text>
            <Text style={styles.docPill}>COMPROBANTE DE PAGO</Text>
          </View>
          <View>
            <Text style={styles.docType}>COMPROBANTE DE PAGO</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>No. PAGO</Text>
              <Text style={styles.metaValue}>{receiptNumber}</Text>
            </View>
            {company.tax_id && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>RNC</Text>
                <Text style={styles.metaValue}>{company.tax_id}</Text>
              </View>
            )}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>FECHA</Text>
              <Text style={styles.metaValue}>{payment.payment_date}</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.sectionTitle}>PAGAMOS A</Text>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Proveedor</Text>
                <Text style={styles.fieldValue}>{supplier.name}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>RNC</Text>
                <Text style={styles.fieldValue}>{supplier.tax_id ?? ""}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Email</Text>
                <Text style={styles.fieldValue}>{supplier.email ?? ""}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Teléfono</Text>
                <Text style={styles.fieldValue}>{supplier.phone ?? ""}</Text>
              </View>
            </View>
            <View style={styles.col}>
              <Text style={styles.sectionTitle}>DETALLE DEL PAGO</Text>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Concepto</Text>
                <Text style={styles.fieldValue}>{expense.description}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Método</Text>
                <Text style={styles.fieldValue}>
                  {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                </Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Pagado desde</Text>
                <Text style={styles.fieldValue}>
                  {bankAccount
                    ? `${bankAccount.name}${bankAccount.bank_name ? ` (${bankAccount.bank_name})` : ""}`
                    : ""}
                </Text>
              </View>
              {payment.payee_bank_name && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Banco destino</Text>
                  <Text style={styles.fieldValue}>{payment.payee_bank_name}</Text>
                </View>
              )}
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Referencia</Text>
                <Text style={styles.fieldValue}>{payment.reference ?? ""}</Text>
              </View>
            </View>
          </View>

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>MONTO PAGADO</Text>
            <Text style={styles.amountValue}>{money(payment.amount, payment.currency)}</Text>
          </View>

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>BALANCE PENDIENTE DEL GASTO</Text>
            <Text style={styles.grandTotalValue}>
              {money(expense.balance, payment.currency)}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          {company.legal_name ?? company.name}
          {company.tax_id ? ` · RNC ${company.tax_id}` : ""}
        </Text>
      </Page>
    </Document>
  );
}
