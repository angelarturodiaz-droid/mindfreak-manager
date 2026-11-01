import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { registerPdfFonts } from "./fonts";
import { letterParagraph, type RetentionLetterData } from "@/features/retention-letters/schema";

/**
 * 4b — Certificación de retención de impuestos (carta al proveedor / DGII).
 * Mismo diseño que los recibos: barra oscura con logo y el color de la marca.
 */

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(amount);
}

function shortDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function longDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
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

const CURRENCY_NOTE: Record<string, string> = {
  DOP: "Valores en pesos dominicanos (RD$).",
  USD: "Valores en dólares estadounidenses (US$).",
};

export function RetentionLetterPdfDocument(d: RetentionLetterData) {
  const dark = d.company.brand_primary || "#0b0e14";
  const accent = d.company.brand_accent || "#17a6b8";
  const accentLight = tintWithWhite(accent, 0.88);
  const cur = d.currency;
  const legalName = d.company.legal_name || d.company.name;
  registerPdfFonts();

  const totals = d.rows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      tax: acc.tax + r.tax,
      itbis: acc.itbis + r.itbisWithheld,
      isr: acc.isr + r.isrWithheld,
      net: acc.net + r.netPaid,
    }),
    { total: 0, tax: 0, itbis: 0, isr: 0, net: 0 },
  );

  const styles = StyleSheet.create({
    page: { fontSize: 10, fontFamily: "Roboto", color: "#1a1a1a" },
    headerBar: {
      backgroundColor: dark,
      paddingHorizontal: 40,
      paddingVertical: 20,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    logoWrap: {
      width: 44,
      height: 44,
      backgroundColor: "#ffffff",
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
      padding: 4,
    },
    logo: { width: "100%", height: "100%", objectFit: "contain" },
    companyName: { color: "#ffffff", fontSize: 13, fontWeight: 700, letterSpacing: 0.5 },
    docPill: {
      marginTop: 8,
      alignSelf: "flex-start",
      backgroundColor: accent,
      color: "#ffffff",
      fontSize: 8,
      fontWeight: 700,
      paddingHorizontal: 9,
      paddingVertical: 3,
      letterSpacing: 0.5,
    },
    docType: { color: accent, fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 1, textAlign: "right" },
    metaRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2, gap: 8 },
    metaLabel: { color: accent, fontSize: 8, fontWeight: 700, width: 60, textAlign: "right" },
    metaValue: { color: "#ffffff", fontSize: 8, width: 110, textAlign: "right" },
    body: { paddingHorizontal: 48, paddingTop: 22, paddingBottom: 60 },
    coName: { fontSize: 10, fontWeight: 700 },
    coLine: { fontSize: 8.5, color: "#374151", marginTop: 1 },
    to: { marginTop: 14 },
    bold: { fontWeight: 700 },
    subject: { marginTop: 14, marginBottom: 8 },
    paragraph: { marginBottom: 6 },
    table: { marginTop: 8, borderWidth: 0.5, borderColor: "#d1d5db" },
    tr: { flexDirection: "row" },
    th: {
      backgroundColor: accentLight,
      color: dark,
      fontSize: 7.5,
      fontWeight: 700,
      paddingVertical: 5,
      paddingHorizontal: 3,
      textAlign: "center",
      borderRightWidth: 0.5,
      borderRightColor: "#d1d5db",
    },
    td: {
      fontSize: 8,
      paddingVertical: 5,
      paddingHorizontal: 3,
      textAlign: "right",
      borderRightWidth: 0.5,
      borderRightColor: "#e5e7eb",
      borderTopWidth: 0.5,
      borderTopColor: "#e5e7eb",
    },
    tot: { fontWeight: 700, backgroundColor: "#f3f4f6" },
    note: { fontSize: 7.5, color: "#6b7280", marginTop: 3 },
    legal: {
      marginTop: 12,
      fontSize: 8.5,
      color: "#374151",
      backgroundColor: "#f9fafb",
      borderLeftWidth: 3,
      borderLeftColor: accent,
      paddingVertical: 7,
      paddingHorizontal: 10,
      lineHeight: 1.25,
    },
    sign: { marginTop: 36, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
    signLine: { width: 220, borderTopWidth: 0.8, borderTopColor: "#1a1a1a", paddingTop: 4 },
    signName: { fontSize: 9, fontWeight: 700 },
    signTitle: { fontSize: 8.5, color: "#374151" },
    seal: {
      width: 110,
      height: 70,
      borderWidth: 0.8,
      borderStyle: "dashed",
      borderColor: "#9ca3af",
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    sealText: { fontSize: 7.5, color: "#9ca3af" },
    footer: {
      position: "absolute",
      bottom: 22,
      left: 48,
      right: 48,
      borderTopWidth: 0.5,
      borderTopColor: "#e5e7eb",
      paddingTop: 5,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    footerText: { fontSize: 7, color: "#9ca3af" },
  });

  // Anchos de columna (suman 100 %).
  const W = ["11%", "14%", "13%", "11%", "11%", "11%", "11%", "18%"];
  const head = ["Fecha de factura", "NCF", "Monto factura", "ITBIS facturado", "Fecha de retención", "ITBIS retenido", "ISR retenido", "Total pagado"];

  return (
    <Document title={`Carta de retención ${d.number}`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerBar}>
          <View>
            {d.company.logo_url && (
              <View style={styles.logoWrap}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf/renderer, no HTML img */}
                <Image src={d.company.logo_url} style={styles.logo} />
              </View>
            )}
            <Text style={styles.companyName}>{d.company.name}</Text>
            <Text style={styles.docPill}>CERTIFICACIÓN DE RETENCIÓN</Text>
          </View>
          <View>
            <Text style={styles.docType}>RETENCIÓN DE IMPUESTOS</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>No.</Text>
              <Text style={styles.metaValue}>{d.number}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>FECHA</Text>
              <Text style={styles.metaValue}>{longDate(d.letterDate)}</Text>
            </View>
            {d.company.tax_id && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>RNC</Text>
                <Text style={styles.metaValue}>{d.company.tax_id}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.coName}>{legalName}</Text>
          <Text style={styles.coLine}>
            {[d.company.tax_id ? `RNC: ${d.company.tax_id}` : null, d.company.address, d.company.phone ? `Tel: ${d.company.phone}` : null]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <Text style={styles.coLine}>Santo Domingo, {longDate(d.letterDate)}</Text>

          <View style={styles.to}>
            {d.addressee.mode === "DGII" ? (
              <>
                <Text>Señor(a)</Text>
                {d.addressee.name ? <Text style={styles.bold}>{d.addressee.name}</Text> : null}
                <Text>{d.addressee.title || "Director General"}</Text>
                <Text style={styles.bold}>Dirección General de Impuestos Internos (DGII)</Text>
                <Text>Ciudad.</Text>
              </>
            ) : d.addressee.mode === "SUPPLIER" ? (
              <>
                <Text>Señores</Text>
                <Text style={styles.bold}>{d.supplier.name}</Text>
                {d.supplier.tax_id ? <Text>RNC/Cédula: {d.supplier.tax_id}</Text> : null}
                <Text>Ciudad.</Text>
              </>
            ) : (
              <Text style={styles.bold}>A quien pueda interesar</Text>
            )}
          </View>

          <Text style={styles.subject}>
            Asunto: <Text style={styles.bold}>Certificación de retención de impuestos.</Text>
          </Text>
          <Text style={styles.paragraph}>Estimados señores:</Text>
          <Text style={styles.paragraph}>{letterParagraph(d)}</Text>

          <View style={styles.table}>
            <View style={styles.tr}>
              {head.map((h, i) => (
                <Text key={h} style={[styles.th, { width: W[i] }]}>
                  {h}
                </Text>
              ))}
            </View>
            {d.rows.map((r, idx) => (
              <View key={idx} style={styles.tr}>
                <Text style={[styles.td, { width: W[0], textAlign: "center" }]}>{shortDate(r.invoiceDate)}</Text>
                <Text style={[styles.td, { width: W[1], textAlign: "center" }]}>{r.ncf || "—"}</Text>
                <Text style={[styles.td, { width: W[2] }]}>{money(r.total, cur)}</Text>
                <Text style={[styles.td, { width: W[3] }]}>{money(r.tax, cur)}</Text>
                <Text style={[styles.td, { width: W[4], textAlign: "center" }]}>{shortDate(r.retentionDate)}</Text>
                <Text style={[styles.td, { width: W[5] }]}>{money(r.itbisWithheld, cur)}</Text>
                <Text style={[styles.td, { width: W[6] }]}>{money(r.isrWithheld, cur)}</Text>
                <Text style={[styles.td, { width: W[7] }]}>{money(r.netPaid, cur)}</Text>
              </View>
            ))}
            <View style={[styles.tr, styles.tot]}>
              <Text style={[styles.td, styles.tot, { width: W[0], textAlign: "center" }]}>TOTAL</Text>
              <Text style={[styles.td, styles.tot, { width: W[1] }]}> </Text>
              <Text style={[styles.td, styles.tot, { width: W[2] }]}>{money(totals.total, cur)}</Text>
              <Text style={[styles.td, styles.tot, { width: W[3] }]}>{money(totals.tax, cur)}</Text>
              <Text style={[styles.td, styles.tot, { width: W[4] }]}> </Text>
              <Text style={[styles.td, styles.tot, { width: W[5] }]}>{money(totals.itbis, cur)}</Text>
              <Text style={[styles.td, styles.tot, { width: W[6] }]}>{money(totals.isr, cur)}</Text>
              <Text style={[styles.td, styles.tot, { width: W[7] }]}>{money(totals.net, cur)}</Text>
            </View>
          </View>
          <Text style={styles.note}>{CURRENCY_NOTE[cur] ?? `Valores en ${cur}.`}</Text>

          <Text style={styles.legal}>{d.legalText}</Text>
          <Text style={[styles.paragraph, { marginTop: 12 }]}>Saludos cordiales,</Text>

          <View style={styles.sign}>
            <View style={styles.signLine}>
              <Text style={styles.signName}>{d.signer.name || "Nombre de quien firma"}</Text>
              <Text style={styles.signTitle}>
                {d.signer.title ? `${d.signer.title} · ` : ""}
                {legalName}
              </Text>
            </View>
            <View style={styles.seal}>
              <Text style={styles.sealText}>Sello</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {legalName}
            {d.company.tax_id ? ` · RNC ${d.company.tax_id}` : ""}
          </Text>
          <Text style={styles.footerText}>Generado por Mindfreak Manager · Gasto: {d.expenseDescription}</Text>
        </View>
      </Page>
    </Document>
  );
}
