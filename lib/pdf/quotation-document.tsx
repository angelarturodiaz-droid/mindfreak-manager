import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { registerPdfFonts } from "./fonts";

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(
    amount,
  );
}

/** Mezcla un color hex con blanco (ej. factor 0.92 = 92% blanco, 8% color) para un tinte sólido suave sin depender de canal alfa (no soportado de forma consistente en @react-pdf). */
function tintWithWhite(hex: string, whiteFactor: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * whiteFactor);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function daysBetween(from: string, to: string): number | null {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86400000));
}

export type QuotationPdfData = {
  company: {
    name: string;
    legal_name: string | null;
    tax_id: string | null;
    address?: string | null;
    phone?: string | null;
    logo_url: string | null;
    brand_primary: string;
    brand_accent: string;
  };
  quotation: {
    number: string;
    issue_date: string;
    valid_until: string | null;
    status: string;
    currency: string;
    subtotal: number;
    commission_percent: number;
    commission_amount: number;
    discount: number;
    tax: number;
    total: number;
    terms: string | null;
    payment_terms_name: string | null;
    credit_days: number | null;
    advance_percent: number | null;
    balance_percent: number | null;
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

export function QuotationPdfDocument({
  company,
  quotation,
  client,
  items,
}: QuotationPdfData) {
  const dark = company.brand_primary || "#0b0e14";
  const accent = company.brand_accent || "#17a6b8";
  const accentLight = tintWithWhite(accent, 0.9);
  const validDays = quotation.valid_until
    ? daysBetween(quotation.issue_date, quotation.valid_until)
    : null;

  registerPdfFonts();

  const styles = StyleSheet.create({
    page: { fontSize: 8.5, fontFamily: "Roboto", color: "#1a1a1a", padding: 28 },
    headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
    logoWrap: {
      width: 42,
      height: 42,
      backgroundColor: "#ffffff",
      borderWidth: 1,
      borderColor: "#e5e7eb",
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
      padding: 4,
    },
    logo: { width: "100%", height: "100%", objectFit: "contain" },
    companyName: { fontSize: 13, fontWeight: 700, color: dark },
    companyLine: { fontSize: 8, color: "#4b5563", marginTop: 1 },
    docTitle: { fontSize: 13, fontWeight: 700, color: dark, textAlign: "right", marginBottom: 6 },
    metaRow: { flexDirection: "row", justifyContent: "flex-end", gap: 6, marginBottom: 2 },
    metaLabel: { fontSize: 8, color: "#4b5563", width: 90, textAlign: "right" },
    metaValue: { fontSize: 8, fontWeight: 700, color: dark, width: 110, textAlign: "right" },
    boxRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
    box: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 4, padding: 8 },
    boxTitle: { fontSize: 8, fontWeight: 700, color: accent, marginBottom: 4, textTransform: "uppercase" },
    boxLine: { fontSize: 8.5, color: "#1a1a1a", marginBottom: 1 },
    table: { marginTop: 6, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 4, overflow: "hidden" },
    tableHeader: { flexDirection: "row", backgroundColor: accent, paddingVertical: 5, paddingHorizontal: 6 },
    th: { color: "#ffffff", fontSize: 7.5, fontWeight: 700 },
    tableRow: {
      flexDirection: "row",
      paddingVertical: 5,
      paddingHorizontal: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e5e7eb",
    },
    colNum: { width: "5%" },
    colDesc: { width: "47%" },
    colQty: { width: "12%", textAlign: "center" },
    colPrice: { width: "17%", textAlign: "right" },
    colTotal: { width: "19%", textAlign: "right" },
    totalAccent: { color: accent, fontWeight: 700 },
    totals: { marginTop: 10, alignSelf: "flex-end", width: 220 },
    totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, paddingHorizontal: 8 },
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
    grandTotalLabel: { color: "#ffffff", fontSize: 9.5, fontWeight: 700 },
    grandTotalValue: { color: "#ffffff", fontSize: 9.5, fontWeight: 700 },
    footer: {
      position: "absolute",
      bottom: 24,
      left: 28,
      right: 28,
      fontSize: 7,
      color: "#9ca3af",
      textAlign: "center",
    },
  });

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {company.logo_url && (
              <View style={styles.logoWrap}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf/renderer, no HTML img */}
                <Image src={company.logo_url} style={styles.logo} />
              </View>
            )}
            <Text style={styles.companyName}>{company.name}</Text>
            {company.address && <Text style={styles.companyLine}>{company.address}</Text>}
            {company.phone && <Text style={styles.companyLine}>Tel: {company.phone}</Text>}
            {company.tax_id && <Text style={styles.companyLine}>RNC: {company.tax_id}</Text>}
          </View>
          <View>
            <Text style={styles.docTitle}>Cotización</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>No. DOC:</Text>
              <Text style={styles.metaValue}>{quotation.number}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Moneda:</Text>
              <Text style={styles.metaValue}>{quotation.currency}</Text>
            </View>
          </View>
        </View>

        <View style={styles.boxRow}>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Datos del cliente</Text>
            <Text style={styles.boxLine}>{client.name}</Text>
            {client.tax_id && <Text style={styles.boxLine}>RNC: {client.tax_id}</Text>}
            {client.phone && <Text style={styles.boxLine}>Tel: {client.phone}</Text>}
            {client.email && <Text style={styles.boxLine}>{client.email}</Text>}
          </View>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Cotización No. / Fecha</Text>
            <Text style={styles.boxLine}>No.: {quotation.number}</Text>
            <Text style={styles.boxLine}>Fecha: {quotation.issue_date}</Text>
            {quotation.valid_until && (
              <Text style={styles.boxLine}>
                Válida hasta: {quotation.valid_until}
                {validDays !== null ? ` (${validDays} días)` : ""}
              </Text>
            )}
            {quotation.payment_terms_name && (
              <Text style={styles.boxLine}>
                Condición de pago: {quotation.payment_terms_name}
                {quotation.advance_percent != null && quotation.balance_percent != null
                  ? ` (${quotation.advance_percent}% anticipo / ${quotation.balance_percent}% saldo)`
                  : ""}
              </Text>
            )}
            {quotation.terms && <Text style={styles.boxLine}>Condiciones: {quotation.terms}</Text>}
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
              <Text style={styles.colPrice}>
                {money(item.unit_price, quotation.currency)}
              </Text>
              <Text style={[styles.colTotal, styles.totalAccent]}>
                {money(item.subtotal, quotation.currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>SUBTOTAL (NETO)</Text>
            <Text style={styles.totalsValue}>
              {money(quotation.subtotal, quotation.currency)}
            </Text>
          </View>
          {quotation.commission_percent > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>COMISIÓN</Text>
              <Text style={styles.totalsValue}>
                {money(quotation.commission_amount, quotation.currency)}
              </Text>
            </View>
          )}
          {quotation.discount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>DESCUENTO</Text>
              <Text style={styles.totalsValue}>
                -{money(quotation.discount, quotation.currency)}
              </Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>ITBIS</Text>
            <Text style={styles.totalsValue}>{money(quotation.tax, quotation.currency)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL {quotation.currency}</Text>
            <Text style={styles.grandTotalValue}>
              {money(quotation.total, quotation.currency)}
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
