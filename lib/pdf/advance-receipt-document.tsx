import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { registerPdfFonts } from "./fonts";

/**
 * Recibo de anticipo (V1-3): «RECIBO DE ANTICIPO», numeración propia
 * ANT-0001. No es factura ni comprobante fiscal: el monto se descuenta de la
 * factura final. Mismo diseño que el recibo de cobro.
 */

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(amount);
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

export type AdvanceReceiptPdfData = {
  company: {
    name: string;
    legal_name: string | null;
    tax_id: string | null;
    logo_url: string | null;
    brand_primary: string;
    brand_accent: string;
  };
  advance: {
    number: string;
    receipt_date: string;
    amount: number;
    currency: string;
    method: string | null;
    reference: string | null;
    before_cutoff: boolean;
    applied_amount: number;
    refunded_amount: number;
    available_amount: number;
  };
  client: { name: string; tax_id: string | null; email: string | null; phone: string | null };
  bankAccount: { name: string; bank_name: string | null } | null;
  /** «Proyecto PROJ-0005 — Boda Pérez», «Cotización COT-0050» o «Anticipo del cliente…». */
  targetLabel: string;
  summary: { totalQuoted: number | null; receivedToDate: number; paidInvoices: number; remaining: number | null };
};

export function AdvanceReceiptPdfDocument({ company, advance, client, bankAccount, targetLabel, summary }: AdvanceReceiptPdfData) {
  const dark = company.brand_primary || "#0b0e14";
  const accent = company.brand_accent || "#17a6b8";
  const accentLight = tintWithWhite(accent, 0.9);
  const docTitle = "RECIBO DE ANTICIPO";
  const cur = advance.currency;

  registerPdfFonts();

  const styles = StyleSheet.create({
    page: { fontSize: 9, fontFamily: "Roboto", color: "#1a1a1a" },
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
    twoCol: { flexDirection: "row", gap: 24, marginBottom: 16 },
    col: { flex: 1 },
    sectionTitle: { color: accent, fontSize: 9, fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 },
    fieldRow: { flexDirection: "row", marginBottom: 5 },
    fieldLabel: { width: 70, fontSize: 8, fontWeight: 700, color: "#374151" },
    fieldValue: { flex: 1, fontSize: 8, borderBottomWidth: 0.5, borderBottomColor: "#d1d5db", paddingBottom: 2 },
    forBox: { marginBottom: 12, paddingVertical: 6, paddingHorizontal: 8, borderLeftWidth: 3, borderLeftColor: accent },
    forLabel: { fontSize: 8, color: "#6b7280" },
    forValue: { fontSize: 10, fontWeight: 700, color: dark },
    amountBox: { marginTop: 4, backgroundColor: accentLight, padding: 16, alignItems: "center" },
    amountLabel: { fontSize: 9, color: "#374151", marginBottom: 4, letterSpacing: 0.5 },
    amountValue: { fontSize: 22, fontWeight: 700, color: accent },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 4,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e5e7eb",
    },
    rowLabel: { fontSize: 9, color: "#374151" },
    rowValue: { fontSize: 9, fontWeight: 700 },
    grandTotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: accent,
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginTop: 10,
    },
    grandTotalLabel: { color: "#ffffff", fontSize: 10, fontWeight: 700 },
    grandTotalValue: { color: "#ffffff", fontSize: 10, fontWeight: 700 },
    notice: {
      marginTop: 18,
      borderWidth: 1,
      borderColor: accent,
      padding: 10,
      fontSize: 8.5,
      color: "#374151",
      lineHeight: 1.4,
    },
    noticeTitle: { fontSize: 9, fontWeight: 700, color: dark, marginBottom: 3 },
    status: { marginTop: 10, fontSize: 8, color: "#6b7280" },
    footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 7, color: "#9ca3af", textAlign: "center" },
  });

  const used = advance.applied_amount > 0 || advance.refunded_amount > 0;

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
            <Text style={styles.docPill}>{docTitle}</Text>
          </View>
          <View>
            <Text style={styles.docType}>{docTitle}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>No. ANTICIPO</Text>
              <Text style={styles.metaValue}>{advance.number}</Text>
            </View>
            {company.tax_id && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>RNC</Text>
                <Text style={styles.metaValue}>{company.tax_id}</Text>
              </View>
            )}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>FECHA</Text>
              <Text style={styles.metaValue}>{advance.receipt_date}</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.forBox}>
            <Text style={styles.forLabel}>ANTICIPO PARA</Text>
            <Text style={styles.forValue}>{targetLabel}</Text>
          </View>

          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.sectionTitle}>RECIBIMOS DE</Text>
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
              <Text style={styles.sectionTitle}>DETALLE DEL PAGO</Text>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Método</Text>
                <Text style={styles.fieldValue}>
                  {advance.method ? (PAYMENT_METHOD_LABELS[advance.method] ?? advance.method) : ""}
                </Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Depositado en</Text>
                <Text style={styles.fieldValue}>
                  {advance.before_cutoff
                    ? "Recibido antes del cambio de sistema"
                    : bankAccount
                      ? `${bankAccount.name}${bankAccount.bank_name ? ` (${bankAccount.bank_name})` : ""}`
                      : ""}
                </Text>
              </View>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Referencia</Text>
                <Text style={styles.fieldValue}>{advance.reference ?? ""}</Text>
              </View>
            </View>
          </View>

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>MONTO RECIBIDO COMO ANTICIPO</Text>
            <Text style={styles.amountValue}>{money(advance.amount, cur)}</Text>
          </View>

          <View style={{ marginTop: 14 }}>
            {summary.totalQuoted !== null && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Total cotizado</Text>
                <Text style={styles.rowValue}>{money(summary.totalQuoted, cur)}</Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Anticipos recibidos hasta este recibo (incluye este)</Text>
              <Text style={styles.rowValue}>{money(summary.receivedToDate, cur)}</Text>
            </View>
            {summary.paidInvoices > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Cobrado de facturas de este evento</Text>
                <Text style={styles.rowValue}>{money(summary.paidInvoices, cur)}</Text>
              </View>
            )}
          </View>
          {summary.remaining !== null && (
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>RESTA POR PAGAR</Text>
              <Text style={styles.grandTotalValue}>{money(summary.remaining, cur)}</Text>
            </View>
          )}

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Importante</Text>
            <Text>
              Este documento no es una factura ni un comprobante fiscal (NCF). Confirma que recibimos este dinero como
              anticipo. El monto se descontará de la factura final del evento, que llevará sus impuestos.
            </Text>
          </View>

          {used && (
            <Text style={styles.status}>
              Estado al imprimir: aplicado a factura {money(advance.applied_amount, cur)}
              {advance.refunded_amount > 0 ? ` · devuelto ${money(advance.refunded_amount, cur)}` : ""} · disponible{" "}
              {money(advance.available_amount, cur)}.
            </Text>
          )}
        </View>

        <Text style={styles.footer}>
          {company.legal_name ?? company.name}
          {company.tax_id ? ` · RNC ${company.tax_id}` : ""}
        </Text>
      </Page>
    </Document>
  );
}
