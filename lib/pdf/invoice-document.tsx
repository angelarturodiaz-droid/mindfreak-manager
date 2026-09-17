import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  ISSUED: "Emitida",
  PARTIALLY_PAID: "Pago parcial",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

/** Mezcla un color hex con blanco para un tinte sólido, sin depender de canal alfa. */
function tintWithWhite(hex: string, whiteFactor: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * whiteFactor);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export type InvoicePdfData = {
  company: {
    name: string;
    legal_name: string | null;
    tax_id: string | null;
    logo_url: string | null;
    brand_primary: string;
    brand_accent: string;
  };
  invoice: {
    number: string;
    issue_date: string;
    due_date: string | null;
    status: string;
    currency: string;
    subtotal: number;
    commission_percent: number;
    commission_amount: number;
    discount: number;
    tax: number;
    total: number;
    paid_amount: number;
    balance: number;
    ncf: string | null;
    payment_terms_name: string | null;
  };
  client: { name: string; tax_id: string | null; email: string | null; phone: string | null };
  items: {
    description: string;
    quantity: number;
    unit_price: number;
    discount: number;
    subtotal: number;
  }[];
};

export function InvoicePdfDocument({ company, invoice, client, items }: InvoicePdfData) {
  const dark = company.brand_primary || "#0b0e14";
  const accent = company.brand_accent || "#17a6b8";
  const accentLight = tintWithWhite(accent, 0.9);

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
    metaLabel: { color: accent, fontSize: 8, fontWeight: 700, width: 60, textAlign: "right" },
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
    fieldLabel: { width: 55, fontSize: 8, fontWeight: 700, color: "#374151" },
    fieldValue: {
      flex: 1,
      fontSize: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: "#d1d5db",
      paddingBottom: 2,
    },
    table: { marginTop: 4 },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: accent,
      paddingVertical: 6,
      paddingHorizontal: 6,
    },
    th: { color: "#ffffff", fontSize: 8, fontWeight: 700, letterSpacing: 0.3 },
    tableRow: {
      flexDirection: "row",
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e5e7eb",
    },
    colNum: { width: "5%" },
    colDesc: { width: "50%" },
    colQty: { width: "12%", textAlign: "center" },
    colPrice: { width: "16%", textAlign: "right" },
    colTotal: { width: "17%", textAlign: "right" },
    totalAccent: { color: accent, fontWeight: 700 },
    totals: { marginTop: 18, alignSelf: "flex-end", width: 220 },
    totalsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    totalsLabel: { fontSize: 8.5, fontWeight: 700 },
    totalsValue: { fontSize: 8.5 },
    grandTotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: accent,
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginTop: 2,
    },
    grandTotalLabel: { color: "#ffffff", fontSize: 10, fontWeight: 700 },
    grandTotalValue: { color: "#ffffff", fontSize: 10, fontWeight: 700 },
    balanceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 4,
      paddingHorizontal: 8,
      marginTop: 6,
      borderTopWidth: 0.5,
      borderTopColor: "#d1d5db",
    },
    balanceLabel: { fontSize: 8.5, fontWeight: 700, color: "#374151" },
    balanceValue: { fontSize: 8.5, fontWeight: 700, color: "#374151" },
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
            <Text style={styles.docPill}>FACTURA</Text>
          </View>
          <View>
            <Text style={styles.docType}>FACTURA</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>No. DOC</Text>
              <Text style={styles.metaValue}>{invoice.number}</Text>
            </View>
            {invoice.ncf && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>NCF</Text>
                <Text style={styles.metaValue}>{invoice.ncf}</Text>
              </View>
            )}
            {company.tax_id && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>RNC</Text>
                <Text style={styles.metaValue}>{company.tax_id}</Text>
              </View>
            )}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>FECHA</Text>
              <Text style={styles.metaValue}>{invoice.issue_date}</Text>
            </View>
            {invoice.due_date && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>VENCE</Text>
                <Text style={styles.metaValue}>{invoice.due_date}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.sectionTitle}>DATOS DEL CLIENTE</Text>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Cliente</Text>
                <Text style={styles.fieldValue}>{client.name}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>RNC</Text>
                <Text style={styles.fieldValue}>{client.tax_id ?? ""}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Email</Text>
                <Text style={styles.fieldValue}>{client.email ?? ""}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Teléfono</Text>
                <Text style={styles.fieldValue}>{client.phone ?? ""}</Text>
              </View>
            </View>
            <View style={styles.col}>
              <Text style={styles.sectionTitle}>ESTADO DE PAGO</Text>
              {invoice.payment_terms_name && (
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Condición</Text>
                  <Text style={styles.fieldValue}>{invoice.payment_terms_name}</Text>
                </View>
              )}
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Estado</Text>
                <Text style={styles.fieldValue}>{INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}</Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Pagado</Text>
                <Text style={styles.fieldValue}>
                  {money(invoice.paid_amount, invoice.currency)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colNum]}>#</Text>
              <Text style={[styles.th, styles.colDesc]}>DESCRIPCIÓN</Text>
              <Text style={[styles.th, styles.colQty]}>CANT.</Text>
              <Text style={[styles.th, styles.colPrice]}>P. UNITARIO</Text>
              <Text style={[styles.th, styles.colTotal]}>TOTAL</Text>
            </View>
            {items.map((item, i) => (
              <View
                key={i}
                style={[styles.tableRow, i % 2 === 0 ? { backgroundColor: accentLight } : {}]}
              >
                <Text style={[styles.colNum, { color: accent, fontWeight: 700 }]}>{i + 1}</Text>
                <Text style={styles.colDesc}>{item.description}</Text>
                <Text style={styles.colQty}>{item.quantity}</Text>
                <Text style={styles.colPrice}>{money(item.unit_price, invoice.currency)}</Text>
                <Text style={[styles.colTotal, styles.totalAccent]}>
                  {money(item.subtotal, invoice.currency)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.totals}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>SUBTOTAL (NETO)</Text>
              <Text style={styles.totalsValue}>{money(invoice.subtotal, invoice.currency)}</Text>
            </View>
            {invoice.commission_percent > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>COMISIÓN ({invoice.commission_percent}%)</Text>
                <Text style={styles.totalsValue}>
                  {money(invoice.commission_amount, invoice.currency)}
                </Text>
              </View>
            )}
            {invoice.discount > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>DESCUENTO</Text>
                <Text style={styles.totalsValue}>
                  -{money(invoice.discount, invoice.currency)}
                </Text>
              </View>
            )}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>ITBIS</Text>
              <Text style={styles.totalsValue}>{money(invoice.tax, invoice.currency)}</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>TOTAL {invoice.currency}</Text>
              <Text style={styles.grandTotalValue}>{money(invoice.total, invoice.currency)}</Text>
            </View>
            {invoice.balance > 0 && (
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>BALANCE PENDIENTE</Text>
                <Text style={styles.balanceValue}>
                  {money(invoice.balance, invoice.currency)}
                </Text>
              </View>
            )}
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
