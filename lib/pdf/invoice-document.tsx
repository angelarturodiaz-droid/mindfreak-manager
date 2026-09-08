import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  companyName: { fontSize: 16, fontWeight: 700 },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  muted: { color: "#6b7280" },
  section: { marginBottom: 16 },
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

export type InvoicePdfData = {
  company: { name: string; legal_name: string | null; tax_id: string | null };
  invoice: {
    number: string;
    issue_date: string;
    due_date: string | null;
    status: string;
    currency: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paid_amount: number;
    balance: number;
    ncf: string | null;
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

export function InvoicePdfDocument({ company, invoice, client, items }: InvoicePdfData) {
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
            <Text style={styles.title}>Factura {invoice.number}</Text>
            {invoice.ncf && <Text style={styles.muted}>NCF: {invoice.ncf}</Text>}
            <Text style={styles.muted}>Fecha: {invoice.issue_date}</Text>
            {invoice.due_date && (
              <Text style={styles.muted}>Vence: {invoice.due_date}</Text>
            )}
            <Text style={styles.muted}>Estado: {invoice.status}</Text>
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
                {money(item.unit_price, invoice.currency)}
              </Text>
              <Text style={styles.colDiscount}>
                {money(item.discount, invoice.currency)}
              </Text>
              <Text style={styles.colSubtotal}>
                {money(item.subtotal, invoice.currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>
              {money(invoice.subtotal, invoice.currency)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalLabel}>Descuento</Text>
            <Text style={styles.totalValue}>
              -{money(invoice.discount, invoice.currency)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalLabel}>Impuesto</Text>
            <Text style={styles.totalValue}>
              {money(invoice.tax, invoice.currency)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={[styles.totalLabel, styles.grandTotal]}>Total</Text>
            <Text style={[styles.totalValue, styles.grandTotal]}>
              {money(invoice.total, invoice.currency)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalLabel}>Pagado</Text>
            <Text style={styles.totalValue}>
              {money(invoice.paid_amount, invoice.currency)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalLabel}>Balance</Text>
            <Text style={styles.totalValue}>
              {money(invoice.balance, invoice.currency)}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
