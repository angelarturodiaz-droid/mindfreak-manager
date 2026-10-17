import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { registerPdfFonts } from "./fonts";
import { cellText, type ExportColumn, type ReportExportData } from "@/features/reports/export-types";

/** Ancho relativo de cada tipo de columna. */
const WEIGHT: Record<ExportColumn["kind"], number> = {
  text: 2.2,
  money: 1.35,
  number: 0.8,
  date: 1,
  percent: 0.85,
  rate: 1,
};

const RIGHT = new Set<ExportColumn["kind"]>(["money", "number", "percent", "rate"]);

/**
 * PDF genérico de un reporte (horizontal, A4): encabezado con la empresa,
 * filtros y fecha de generación, resumen, tablas con todas las filas y pie
 * "Página X de Y". Se genera en el navegador, como los demás PDF.
 */
export function ReportPdfDocument(data: ReportExportData) {
  registerPdfFonts();
  const dark = data.company.brand_primary || "#0b0e14";
  const many = data.sections.some((s) => s.columns.length > 9);

  const styles = StyleSheet.create({
    page: {
      fontSize: many ? 7 : 8,
      fontFamily: "Roboto",
      color: "#1a1a1a",
      paddingTop: 28,
      paddingBottom: 36,
      paddingHorizontal: 28,
    },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
    brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    logo: { width: 34, height: 34, objectFit: "contain" },
    company: { fontSize: 10, fontWeight: 700, color: dark },
    muted: { color: "#6b7280" },
    title: { fontSize: 15, fontWeight: 700, color: dark, marginTop: 6 },
    description: { color: "#4b5563", marginTop: 2, maxWidth: 520 },
    metaBox: { alignItems: "flex-end" },
    filters: {
      marginTop: 6,
      marginBottom: 8,
      padding: 6,
      backgroundColor: "#f3f4f6",
      borderRadius: 3,
      color: "#374151",
    },
    summary: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
    summaryItem: {
      borderWidth: 0.5,
      borderColor: "#d1d5db",
      borderRadius: 3,
      paddingVertical: 4,
      paddingHorizontal: 8,
      minWidth: 110,
    },
    summaryLabel: { color: "#6b7280", fontSize: 7 },
    summaryValue: { fontWeight: 700, fontSize: 9, marginTop: 1 },
    sectionTitle: { fontSize: 10, fontWeight: 700, color: dark, marginTop: 8, marginBottom: 3 },
    sectionNote: { color: "#6b7280", marginBottom: 3 },
    headRow: { flexDirection: "row", backgroundColor: dark, color: "#ffffff" },
    row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" },
    rowAlt: { backgroundColor: "#f9fafb" },
    totalRow: { flexDirection: "row", backgroundColor: "#eef2f7", borderTopWidth: 0.8, borderTopColor: dark },
    cell: { paddingVertical: 3, paddingHorizontal: 4 },
    headCell: { paddingVertical: 4, paddingHorizontal: 4, fontWeight: 700 },
    bold: { fontWeight: 700 },
    empty: { padding: 6, color: "#6b7280" },
    notes: { marginTop: 10, color: "#6b7280" },
    footer: {
      position: "absolute",
      bottom: 16,
      left: 28,
      right: 28,
      flexDirection: "row",
      justifyContent: "space-between",
      color: "#9ca3af",
      fontSize: 7,
    },
  });

  return (
    <Document title={data.title} author={data.company.name}>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <View style={styles.header}>
          <View>
            <View style={styles.brandRow}>
              {data.company.logo_url && (
                // eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf/renderer, no HTML img
                <Image src={data.company.logo_url} style={styles.logo} />
              )}
              <View>
                <Text style={styles.company}>{data.company.legal_name || data.company.name}</Text>
                {data.company.tax_id && <Text style={styles.muted}>RNC {data.company.tax_id}</Text>}
              </View>
            </View>
            <Text style={styles.title}>{data.title}</Text>
            <Text style={styles.description}>{data.description}</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.muted}>Generado: {data.generatedAt}</Text>
            {data.generatedBy && <Text style={styles.muted}>Por: {data.generatedBy}</Text>}
            <Text style={styles.muted}>Moneda base: {data.company.base_currency}</Text>
          </View>
        </View>

        <Text style={styles.filters}>
          <Text style={styles.bold}>Filtros: </Text>
          {data.filters.length ? data.filters.join("  ·  ") : "ninguno (todo)"}
        </Text>

        {data.summary.length > 0 && (
          <View style={styles.summary}>
            {data.summary.map((s, i) => (
              <View key={i} style={styles.summaryItem} wrap={false}>
                <Text style={styles.summaryLabel}>{s.label}</Text>
                <Text style={styles.summaryValue}>{cellText(s.value, { header: "", kind: "number" })}</Text>
              </View>
            ))}
          </View>
        )}

        {data.sections.map((sec, si) => {
          // Columnas de texto: ancho según lo que traen (las cortas como "Tipo" no ocupan de más).
          const weights = sec.columns.map((c, ci) => {
            if (c.kind !== "text") return WEIGHT[c.kind];
            const lens = sec.rows.map((r) => Math.min(42, cellText(r[ci] ?? null, c).length));
            const longest = Math.max(c.header.length * 0.8, ...lens, 4);
            return Math.min(3.2, Math.max(0.7, longest / 9));
          });
          const total = weights.reduce((a, w) => a + w, 0);
          const widths = weights.map((w) => `${(w / total) * 100}%`);
          const widthOf = (c: ExportColumn) => widths[sec.columns.indexOf(c)];
          const align = (c: ExportColumn) => (RIGHT.has(c.kind) ? ("right" as const) : ("left" as const));
          return (
            <View key={si}>
              {/* Título y encabezado no quedan solos al final de una página. */}
              <View wrap={false} minPresenceAhead={40}>
                {sec.title && <Text style={styles.sectionTitle}>{sec.title}</Text>}
                {sec.note && <Text style={styles.sectionNote}>{sec.note}</Text>}
                <View style={styles.headRow}>
                  {sec.columns.map((c, ci) => (
                    <Text key={ci} style={[styles.headCell, { width: widthOf(c), textAlign: align(c) }]}>
                      {c.header}
                    </Text>
                  ))}
                </View>
              </View>
              {sec.rows.length === 0 && <Text style={styles.empty}>Sin datos con estos filtros.</Text>}
              {sec.rows.map((row, ri) => (
                <View key={ri} style={ri % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row} wrap={false}>
                  {sec.columns.map((c, ci) => (
                    <Text key={ci} style={[styles.cell, { width: widthOf(c), textAlign: align(c) }]}>
                      {cellText(row[ci] ?? null, c)}
                    </Text>
                  ))}
                </View>
              ))}
              {sec.totals && (
                <View style={styles.totalRow} wrap={false}>
                  {sec.columns.map((c, ci) => {
                    const v = sec.totals![ci] ?? null;
                    return (
                      <Text key={ci} style={[styles.cell, styles.bold, { width: widthOf(c), textAlign: align(c) }]}>
                        {v === null || v === "" ? "" : cellText(v, c)}
                      </Text>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {data.notes.length > 0 && (
          <View style={styles.notes} wrap={false}>
            {data.notes.map((n, i) => (
              <Text key={i}>• {n}</Text>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>
            {data.company.name} · {data.title}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
