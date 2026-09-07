import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  companyName: { fontSize: 16, fontWeight: 700 },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  muted: { color: "#6b7280" },
  section: { marginBottom: 16 },
  row: { flexDirection: "row" },
  table: { marginTop: 12 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    paddingBottom: 4,
    marginBottom: 4,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 4,
  },
  colDesc: { width: "40%" },
  colQty: { width: "12%", textAlign: "right" },
  colPrice: { width: "16%", textAlign: "right" },
  colDiscount: { width: "16%", textAlign: "right" },
  colSubtotal: { width: "16%", textAlign: "right" },
  totals: { marginTop: 16, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", gap: 40, marginBottom: 2 },
  totalLabel: { width: 100, textAlign: "right" },
  totalValue: { width: 80, textAlign: "right" },
  grandTotal: { fontSize: 12, fontWeight: 700 },
});

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

export type QuotationPdfData = {
  company: { name: string; legal_name: string | null; tax_id: string | null };
  quotation: {
    number: string;
    issue_date: string;
    valid_until: string | null;
    status: string;
    currency: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    terms: string | null;
  };
  client: { name: string };
  items: {
    description: string;
    quantity: number;
    unit_price: number;
    discount: number;
    subtotal: number;
  }[];
};

export function QuotationPdfDocument({
  company,
  quotation,
  client,
  items,
}: QuotationPdfData) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{company.name}</Text>
            {company.legal_name && <Text style={styles.muted}>{company.legal_name}</Text>}
            {company.tax_id && <Text style={styles.muted}>RNC: {company.tax_id}</Text>}
          </View>
          <View>
            <Text style={styles.title}>Cotización {quotation.number}</Text>
            <Text style={styles.muted}>Fecha: {quotation.issue_date}</Text>
            {quotation.valid_until && (
              <Text style={styles.muted}>Válida hasta: {quotation.valid_until}</Text>
            )}
            <Text style={styles.muted}>Estado: {quotation.status}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={{ fontWeight: 700 }}>Cliente</Text>
          <Text>{client.name}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Descripción</Text>
            <Text style={styles.colQty}>Cant.</Text>
            <Text style={styles.colPrice}>Precio</Text>
            <Text style={styles.colDiscount}>Descuento</Text>
            <Text style={styles.colSubtotal}>Subtotal</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>
                {money(item.unit_price, quotation.currency)}
              </Text>
              <Text style={styles.colDiscount}>
                {money(item.discount, quotation.currency)}
              </Text>
              <Text style={styles.colSubtotal}>
                {money(item.subtotal, quotation.currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>
              {money(quotation.subtotal, quotation.currency)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalLabel}>Descuento</Text>
            <Text style={styles.totalValue}>
              -{money(quotation.discount, quotation.currency)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalLabel}>Impuesto</Text>
            <Text style={styles.totalValue}>
              {money(quotation.tax, quotation.currency)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={[styles.totalLabel, styles.grandTotal]}>Total</Text>
            <Text style={[styles.totalValue, styles.grandTotal]}>
              {money(quotation.total, quotation.currency)}
            </Text>
          </View>
        </View>

        {quotation.terms && (
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontWeight: 700, marginBottom: 4 }}>
              Condiciones
            </Text>
            <Text style={styles.muted}>{quotation.terms}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
